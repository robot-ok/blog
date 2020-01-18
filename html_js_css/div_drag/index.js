/**
 * 实现div拖动的代码
 */
var x = 0;
var flag = 0;

//点击滑滑滑  div滑动
function move() {
    if (flag == 0) {
        moveDiv();
    }
}

//点击停停停  div停下
function stopDiv() {
    clearTimeout(flag);
    flag = 0;
    x = parseInt(document.getElementById("div").style.left.split("px")[0]);
}

//div滑动的实现
function moveDiv() {
    var div = document.getElementById("div");
    x += 2;
    if (x > 1200)
        x = 0;

    div.style.left = x + "px";
    flag = setTimeout("moveDiv()", 10);
}


//下面是div拖动-----------

var div1 = document.getElementById("div");

//拖动div   鼠标按下
div1.onmousedown = function(event) {
    var addx = event.clientX - div1.offsetLeft;
    var addy = event.clientY - div1.offsetTop;
    div1.onmousemove = function(event) {
        div1.style.left = event.clientX - addx + "px";
        div1.style.top = event.clientY - addy + "px";

    }

}
//拖动div    鼠标松开
div1.onmouseup = function() {
    div1.onmousemove = null;
}