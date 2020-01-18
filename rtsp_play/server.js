var kurento = require('kurento-client');
var express = require('express');
var app = express();
var path = require('path');



app.use(express.static(path.join(__dirname, 'static')))
app.listen(8080, () => {
	console.log(`App listening at port 8080`)
})

const
ws_uri = "ws://192.168.22.131:8888/kurento",
rtsp_uri = "rtsp://192.168.1.233:554/user=admin_password=6V0Y4HLF_channel=1_stream=0.sdp?real_stream";

var idCounter = 0;
var candidatesQueue = {};
var master = null;
var pipeline = null;
var viewers = {};
var kurentoClient = null;
var playerEndpoint = null;
function nextUniqueId()
{
	idCounter++;
	return idCounter.toString();
}


var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8889})

// Master Stream hasn't been set
startRTSP(function(error)
{
	console.log('**********************startRTSP(function(error) ');
	if (error) {
		return console.error(error);
	}
});

/*
 * Management of WebSocket messages
 */
wss.on('connection', function(ws)
{

	var sessionId = nextUniqueId();

	console.log('************************Connection received with sessionId ' + sessionId);

	ws.on('error', function(error) {
		console.log('*********************Connection ' + sessionId + ' error');
		stop(sessionId);
	});

	ws.on('close', function() {
		console.log('**************************Connection ' + sessionId + ' closed');
		stop(sessionId);
	});

	ws.on('message', function(_message) {
		var message = JSON.parse(_message);
		console.log('*************************Connection ' + sessionId + ' received message ', message);

		switch (message.id) {

		case 'viewer':

			startViewer(sessionId, message.sdpOffer, ws, function(error, sdpAnswer) {
				if (error) {
					return ws.send(JSON.stringify({
						id : 'viewerResponse',
						response : 'rejected',
						message : error
					}));
				}

				ws.send(JSON.stringify({
					id : 'viewerResponse',
					response : 'accepted',
					sdpAnswer : sdpAnswer
				}));
			});
			break;

		case 'stop':
			stop(sessionId);
			break;
			
		case 'onIceCandidate':
            onIceCandidate(sessionId, message.candidate);
            break;

		default:
			ws.send(JSON.stringify({
				id : 'error',
				message : 'Invalid message ' + message
			}));
			break;
		}
	});
});


// Recover kurentoClient for the first time.
function getKurentoClient(callback)
{
	if (kurentoClient !== null) {
		return callback(null, kurentoClient);
	}

	kurento(ws_uri, function(error, _kurentoClient) {
		if (error) {
			console.log("*******************Coult not find media server at address " + ws_uri);
			return callback("Could not find media server at address" + ws_uri
					+ ". Exiting with error " + error);
		}

		kurentoClient = _kurentoClient;
		callback(null, kurentoClient);
	});
}

/* Start PlayerEndpoint instead */
function startRTSP(callback)
{
	console.log('********************function startRTSP(callback) {');
	if (master !== null) {
		console.error("Error**************Master is not running ...");
		return ;
	}

	master = true;

	getKurentoClient(function(error, kurentoClient) {
		if (error) {
			stop(id);
			console.error('Error**************getKurentoClient(function(error, kurentoClient) {');
			//return callback(error);
			return;
		}

		kurentoClient.create('MediaPipeline', function(error, _pipeline) {
			if (error) {
				console.error("Error**************kurentoClient.create('MediaPipeline', function(error, _pipeline) {");
				//return callback(error);
				return;
			}

			// PlayerEndpoint params
			var params = {
				//mediaPipeline: _pipeline,
				networkCache: 0,
				uri: rtsp_uri,
				useEncodedMedia: false // true
			};

			pipeline = _pipeline;
			pipeline.create('PlayerEndpoint', params, function(error, _playerEndpoint) {
				if (error) {
					console.error("Error**************pipeline.create('PlayerEndpoint', params, function(error, PlayerEndpoint) {");
					//return callback(error);
					return
				}
				playerEndpoint = _playerEndpoint;
				console.log('***************Preparing to play');
				playerEndpoint.play(function(error) {
					if (error) {
						console.error("Error**************playerEndpoint.play(function(error) {");
						//return callback(error);
						return;
					}
					console.log('**************Now playing');
				});

			});

		});
	});
}

function startViewer(id, sdp, ws, callback)
{
	console.log('***************startViewer(id, sdp, ws, callback) {');
	if (master === null || master.webRtcEndpoint === null) {
		console.error("Error**************No active streams available. Try again later ...");
		return callback("No active streams available. Try again later ...");
	}

	if (viewers[id]) {
		console.error("Error**************You are already viewing in this session. Use a different browser to add additional viewers.");
		return callback("You are already viewing in this session. Use a different browser to add additional viewers.")
	}

	pipeline.create('WebRtcEndpoint', function(error, webRtcEndpoint) {
		console.log("**************pipeline.create('WebRtcEndpoint',");
		if (error) {
			console.error("Error**************pipeline.create('WebRtcEndpoint.");
			return callback(error);
		}

		if (master === null) {
			stop(id);
			console.error("Error**************No active streams available. Try again later ...");
			return callback("No active streams available. Try again later ...");
		}
		
		
		var viewer = {
			id : id,
			ws : ws,
			webRtcEndpoint : webRtcEndpoint
		};
		viewers[viewer.id] = viewer;

		master = {webRtcEndpoint: webRtcEndpoint};
		
		
		if (candidatesQueue[id]) {
			while(candidatesQueue[id].length) {
				var candidate = candidatesQueue[id].shift();
				webRtcEndpoint.addIceCandidate(candidate);
			}
		}

        webRtcEndpoint.on('OnIceCandidate', function(event) {
			console.log("**************webRtcEndpoint.on('OnIceCandidate', function(event) {");
            var candidate = kurento.register.complexTypes.IceCandidate(event.candidate);
            ws.send(JSON.stringify({
                id : 'iceCandidate',
                candidate : candidate
            }));
        });
		
		webRtcEndpoint.processOffer(sdp, function(error, sdpAnswer) {
			console.log("**************webRtcEndpoint.processOffer(sdp,");
			if (error) {
				stop(id);
				console.error("Error**************webRtcEndpoint.processOffer(sdp,");
				return callback(error);
			}

			if (master === null) {
				stop(id);
				console.error("Error**************No active streams available. Try again later ...");
				return callback("No active streams available. Try again later ...");
			}

			//master.webRtcEndpoint.connect(webRtcEndpoint, function(error) {
			playerEndpoint.connect(webRtcEndpoint, function(error) {
				console.log("**************master.webRtcEndpoint.connect(webRtcEndpoint");
				if (error) {
					stop(id);
					console.error("Error**************master.webRtcEndpoint.connect(webRtcEndpoint");
					return callback(error, getState4Client());
				}

				if (master === null) {
					stop(id);
					console.error("Error**************No active sender now. Become sender or . Try again later ...");
					return callback("No active sender now. Become sender or . Try again later ...");
				}

				/*var viewer = {
					id : id,
					ws : ws,
					webRtcEndpoint : webRtcEndpoint
				};
				viewers[viewer.id] = viewer;*/

				return callback(null, sdpAnswer);
			});
		});
		webRtcEndpoint.gatherCandidates(function(error) {
			if (error) {
				stop(sessionId);
				return callback(error);
			}
		});
	});
}

function clearCandidatesQueue(sessionId)
{
	if (candidatesQueue[sessionId]) {
		delete candidatesQueue[sessionId];
	}
}

function onIceCandidate(sessionId, _candidate)
{
    var candidate = kurento.register.complexTypes.IceCandidate(_candidate);

 if (viewers[sessionId] && viewers[sessionId].webRtcEndpoint) {
        console.info('***************Sending viewer candidate');
        viewers[sessionId].webRtcEndpoint.addIceCandidate(candidate);
    }
    else {
        console.info('Queueing candidate');
        if (!candidatesQueue[sessionId]) {
            candidatesQueue[sessionId] = [];
        }
        candidatesQueue[sessionId].push(candidate);
    }
}

function stop(id)
{
	if (viewers[id]) {
		var viewer = viewers[id];
		if (viewer.webRtcEndpoint)
			viewer.webRtcEndpoint.release();
		delete viewers[id];

		pipeline.release();
		pipeline = null;
		master = null;
	}
	clearCandidatesQueue(id);
}

//app.use(express.static(path.join(__dirname, 'static')));