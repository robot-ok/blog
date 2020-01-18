

document.write("<script type='text/javascript' src='bower_components/kurento-utils/js/kurento-utils.js'></script>"); 
var ws = new WebSocket('ws://'+document.domain+':8889');
var video;
var webRtcPeer;

window.onload = function() {
	//console = new Console();
	video = document.getElementById('video');

	//document.getElementById('btn-open-video').addEventListener('click', function() { presenter(); } );
	document.getElementById('btn-receive-video').addEventListener('click', function() { viewer(); } );
	//document.getElementById('btn-close-video').addEventListener('click', function() { stop(); } );
}

window.onbeforeunload = function() {
	ws.close();
}

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	//console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'presenterResponse':
		presenterResponse(parsedMessage);
		break;
	case 'viewerResponse':
		viewerResponse(parsedMessage);
		break;
	case 'stopCommunication':
		dispose();
		break;
	case 'iceCandidate':
		//console.log("******************************************************iceCandidate message");
		webRtcPeer.addIceCandidate(parsedMessage.candidate)
		break;
	default:
		//console.error('Unrecognized message', parsedMessage);
	}
}

function presenterResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		//console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function viewerResponse(message) {
	if (message.response != 'accepted') {
		var errorMsg = message.message ? message.message : 'Unknow error';
		//console.warn('Call not accepted for the following reason: ' + errorMsg);
		dispose();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer);
	}
}

function presenter() {
	if (!webRtcPeer) {
		showSpinner(video);
		//  var iceservers={
        // "iceServers": [
		// {
        //      urls: "stun:173.194.202.127:19302"
        // },
		// {
		// 	urls:"turn:turn.igustudio.com:3478",
		// 	username:"helloword",
		// 	credential:"helloword"
		// }
		//
		// ]
		//  }
		 /********************/
		var iceservers={
			iceServers: [
				{
					urls: "stun:39.98.200.94:3478"
				},
				{
					urls:["turn:39.98.200.94:3478"],
					username:"kurento",
					credential:"kurento"
				}
			]
		}
		/********************/


		 var options = {
		 	localVideo: video,
		 	onicecandidate : onIceCandidate,
		 	configuration: iceservers
	     }

		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options, function(error) {
			if(error) return onError(error);

			this.generateOffer(onOfferPresenter);
		});
	}
}

function onOfferPresenter(error, offerSdp) {
    if (error) return onError(error);

	var message = {
		id : 'presenter',
		sdpOffer : offerSdp
	};
	sendMessage(message);
}

function viewer() {
	if (!webRtcPeer) {
		showSpinner(video);

		var options = {
			remoteVideo: video,
			onicecandidate : onIceCandidate
		}

		webRtcPeer = kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options, function(error) {
			if(error) return onError(error);

			this.generateOffer(onOfferViewer);
		});
	}
}

function onOfferViewer(error, offerSdp) {
	if (error) return onError(error)

	var message = {
		id : 'viewer',
		sdpOffer : offerSdp
	}
	sendMessage(message);
}

function onIceCandidate(candidate) {
	   //console.log('Local candidate' + JSON.stringify(candidate));

	   var message = {
	      id : 'onIceCandidate',
	      candidate : candidate
	   }
	   sendMessage(message);
}

function stop() {
	if (webRtcPeer) {
		var message = {
				id : 'stop'
		}
		sendMessage(message);
		dispose();
	}
}

function dispose() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	hideSpinner(video);
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	//console.log('Senging message: ' + jsonMessage);
	ws.send(jsonMessage);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = 'center transparent url("./img/spinner.gif") no-repeat';
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}


