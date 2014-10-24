(function() {

    // 192.168.122.1 10.0.0.1 localhost
    var config = {
            url: 'http://192.168.122.1:8080/sony',
            autoStart: false,
            touchAF: true,
            testMode: false
    };

    if (document.readyState === 'complete') {
        onPageLoaded();
    } else {
        document.addEventListener('DOMContentLoaded', function loaded() {
            document.removeEventListener('DOMContentLoaded', loaded);
            onPageLoaded();
        });
    }
    window.addEventListener('unload', onPageUnload);
    
    var logResponse = function(res) {
        console.log('Response:');
        console.log(res.getJSON());
    };

    var crSend = function(content, callback, context) {
        var xhr = new XMLHttpRequest({mozSystem: true});
        var url = config.url;
        url += '/camera';
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Accept', 'application/json, text/javascript, text/plain');
        xhr.setRequestHeader('Content-type', 'application/json; charset=UTF-8');
        var result = {
                status: xhr.status,
                xhr: xhr,
                getJSON: function() {
                    if (xhr.status === 200) { //  || xhr.status === 0
                        return JSON.parse(xhr.responseText);
                    }
                    throw 'XMLHttpRequest failed, status: ' + xhr.status;
                },
                getResult: function() {
                    var obj = result.getJSON();
                    if ('error' in obj) {
                        //"error": [0, "OK"]
                        var error = 'Error #' + obj.error[0] +  ': ' + obj.error[1];
                        notify(error);
                        throw error;
                    }
                    if ('result' in obj) {
                        return obj.result;
                    }
                    null;
                }
        };
        if (typeof callback !== 'function') {
            callback = function() {};
        }
        if (typeof context === 'undefined') {
            context = result;
        }
        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) {
                return;// Not completed
            }
            callback.call(context, result);
        }
        /*xhr.onerror = function () {
            callback.call(context, result);
        };*/
        xhr.send(JSON.stringify(content, null, ''));
    };

    config = fetchFromStore('config', config);
    var saveConfig = function() {
        putInStore('config', config);
    };
    

    var recModeStarted = false;
    var liveViewSocket = null;
    var eventPolling = false;
    var initializing = false;
    var animationRequestId = null;

    var requestAnimation = function(fn) {
        animationRequestId = requestAnimationFrame(fn);
    };
    var cancelAnimation = function() {
        cancelAnimationFrame(animationRequestId);
        animationRequestId = null;
    };

    var stopClick = function(event) {
        event.stopPropagation();
    };

    var onEvent = function(result) {
        console.log('getEvent', result);
    };
    var pollEvent = function() {
        console.log('pollEvent');
        crSend({
            "method": "getEvent",
            "params": [true],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            try {
                onEvent(response.getResult());
            } catch (e) {
                eventPolling = false;
            }
            // keep polling
            if (eventPolling) {
                pollEvent();
            }
        });
    };

    var startPolling = function() {
        if (eventPolling) {
            return;
        }
        eventPolling = true;
        pollEvent();
    };

    var stopPolling = function() {
        eventPolling = false;
    };

    var togglePolling = function () {
        console.log('toggle polling');
        if (eventPolling) {
            stopPolling();
        } else {
            startPolling();
        }
    };

    var startRecMode = function() {
        if (recModeStarted) {
            return;
        }
        console.log('startRecMode');
        crSend({
            "method": "startRecMode",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            recModeStarted = response.getResult() != null;
            if (recModeStarted) {
                notify('Record mode started');
                if (initializing) {
                    initializing = false;
                    startLiveview();
                }
            }
        });
    };

    var stopRecMode = function() {
        if (! recModeStarted) {
            return;
        }
        console.log('stopRecMode');
        recModeStarted = false;
        crSend({
            "method": "stopRecMode",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            notify('Record mode stopped');
        });
    };
    
    var toggleRecMode = function () {
        console.log('toggle rec mode');
        if (recModeStarted) {
            stopRecMode();
        } else {
            startRecMode();
        }
    };
    
    var openLiveView = function(url) {
        if (liveViewSocket != null) {
            liveViewSocket.close();
            liveViewSocket = null;
        }
        console.log('openLiveView(' + url + ')');
        var i = url.indexOf('://') + 3;
        var j = url.indexOf('/', i);
        var fileURL = url.substring(j);
        var k = url.indexOf(':', i);
        var hostURL = url.substring(i, k);
        var portURL = parseInt(url.substring(k + 1, j));

        //console.log('hostURL: ' + hostURL + ', portURL: ' + portURL + ', fileURL: ' + fileURL);
        liveViewSocket = navigator.mozTCPSocket.open(hostURL, portURL, {"binaryType": "arraybuffer"});
        liveViewSocket.onerror = function (event) {
            console.log('liveViewSocket.onerror "' + event.data + '"');
            liveViewSocket = null;
        };
        liveViewSocket.onopen = function (event) {
        try {
            console.log('liveViewSocket.onopen()');
            var liveViewRequest = buildHttpRequest('GET', fileURL, '', {
              "Accept": "application/json, text/javascript, text/plain",
              "Content-type": "application/json; charset=UTF-8"
            });
            var barray = strToUTF8Arr(liveViewRequest);
            //console.log('sending ' + barray.byteLength + ' bytes...');
            /*
             * https://bugzilla.mozilla.org/show_bug.cgi?id=1057557
             * Improve error message when passing a Uint*Array to mozTCPSocket.send instead of an ArrayBuffer
             */
            //var result = liveViewSocket.send(barray, 0, barray.byteLength);
            var result = liveViewSocket.send(barray.buffer, 0, barray.byteLength);
            //console.log('...sent ' + result + ' buffered ' + liveViewSocket.bufferedAmount);
        } catch (e) {
            console.log('uncaught "' + e + '"');
            liveViewSocket = null;
        }
        };
        
        var syncTime = 0;
        var syncDelta = 0;
        var lasttime = 0;

        var onImage = function(barray, sequenceNum, timestamp) {
            var time = new Date().getTime();
            var st = time - timestamp;
            if (syncTime == 0) {
                syncTime = st;
            }
            syncDelta = st - syncTime;
            //console.log('onImage(), #' + sequenceNum + ', syncDelta: ' + syncDelta);
            if ((time - lasttime > 300) && (syncDelta < 1000)) {
                //console.log('displaying...');
                // data:image/jpeg;base64,/9j/4A...
                var liveViewImageBase64 = 'data:image/jpeg;base64,' + base64EncArr(barray);
                //requestAnimationFrame(function() {
                    liveViewImage.src = liveViewImageBase64;
                //});
                lasttime = time;
            }
        };

        var processor = new HttpHeaderProcessor(new HttpChunkProcessor(new HttpLiveviewProcessor(onImage)));
        if (config.testMode) {
            processor = new HttpHeaderProcessor(new HttpLiveviewProcessor(onImage));
        }
        
        liveViewSocket.ondata = function (event) {
            //console.log('ondata(' + event.data.byteLength + ')');
            try {
                processor.process(new Uint8Array(event.data));
            } catch (e) {
                console.log('uncaught "' + e + '"');
                liveViewSocket.close();
                liveViewSocket = null;
                throw e;
            }
        };
    };

    var startLiveview = function() {
        if (liveViewSocket != null) {
            liveViewSocket.close();
            liveViewSocket = null;
        }
        console.log('live view');
        crSend({
            "method": "startLiveview",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            var liveViewURL = response.getResult()[0];
            console.log('liveViewURL "' + liveViewURL + '"');
            openLiveView(liveViewURL);
        });
    };

    var stopLiveview = function() {
        if (liveViewSocket == null) {
            return;
        }
        console.log('stopLiveview');
        liveViewSocket.close();
        liveViewSocket = null;
        crSend({
            "method": "stopLiveview",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            notify('Live view stopped');
        });
    };

    var toggleLiveview = function () {
        console.log('toggle live view');
        if (liveViewSocket == null) {
            startLiveview();
        } else {
            stopLiveview();
        }
    };

    var shoot = function(event) {
        console.log('shooting');
        event.stopPropagation();
        crSend({
            "method": "actTakePicture",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            shootImage.src = response.getResult()[0][0];
        });
    };
    
    var zoomAction = null;
    var zoomStop = function() {
        if (zoomAction == null) {
            return;
        }
        console.log('zoomStop() ' + zoomAction);
        var previousZoomAction = zoomAction;
        zoomAction = null;
        crSend({
            "method": "actZoom",
            "params": [previousZoomAction, "stop"],
            "id": 1,
            "version": "1.0"
        });
    };
    var zoomStart = function(action) {
        console.log('zoomStart(' + action + ')');
        zoomStop();
        zoomAction = action;
        crSend({
            "method": "actZoom",
            "params": [zoomAction, "start"],
            "id": 1,
            "version": "1.0"
        });
    };
    var zoomCancel = function(event) {
        //console.log('zoomCancel');
        event.stopPropagation();
        zoomStop();
    };
    var zoomIn = function(event) {
        //console.log('zoomIn');
        event.stopPropagation();
        zoomStart("in");
    };
    var zoomOut = function(event) {
        //console.log('zoomOut');
        event.stopPropagation();
        zoomStart("out");
    };
    
    var cancelFocus = function() {
        console.log('cancelFocus()');
        crSend({
            "method": "cancelTouchAFPosition",
            "params": [],
            "id": 1,
            "version": "1.0"
        });
    };
    
    var hideFocusCircle = function() {
        focusCircle.style.display = 'none';
    };
    var offset = document.querySelector('#drawer header').offsetHeight;
    console.log('offset: ' + offset);
    
    var onFocus = function(event) {
        console.log('onFocus()');
        var c = {
            x : event.layerX,
            y : event.layerY + offset
        };
        var point = [
            Math.round(c.x * 1000 / liveViewImage.width) / 10,
            Math.round(c.y * 1000 / liveViewImage.height) / 10
        ];
        console.log(point);
        if (! config.touchAF) {
            return;
        }
        var radius = 32;
        focusCircle.style.width = (radius * 2) + 'px';
        focusCircle.style.height = (radius * 2) + 'px';
        focusCircle.style.left = Math.floor(c.x - radius) + 'px';
        focusCircle.style.top = Math.floor(c.y - radius) + 'px';
        focusCircle.style.display = '';
        window.setTimeout(hideFocusCircle, 3000);
        
        crSend({
            "method": "setTouchAFPosition",
            "params": point,
            "id": 1,
            "version": "1.0"
        }, function(response) {
            hideFocusCircle();
            if (! response.getResult()[1].AFResult) {
                notify('Failure to AF');
            }
        });
    };

    var onPageLoaded = function() {
        console.log('initializing...');
        initializing = true;
        //startPolling();
        startRecMode();
    };

    var onPageUnload = function() {
        console.log('unloading...');
        //saveConfig();
        cancelFocus();
        stopRecMode();
        stopLiveview();
        stopPolling();
    };

    initializeSection({
        id: 'pref',
        buttonId: 'btn-pref',
        open: function() {
            this.element.querySelector('#url').value = config.url;
            this.element.querySelector('#cb-live-view').checked = (liveViewSocket != null);
            this.element.querySelector('#cb-rec-mode').checked = recModeStarted;
            this.element.querySelector('#cb-polling').checked = eventPolling;
            this.element.querySelector('#cb-touch-af').checked = config.touchAF;
            this.element.querySelector('#cb-test-mode').checked = config.testMode;
        },
        confirm: function() {
            config.url = this.element.querySelector('#url').value;
            config.touchAF = this.element.querySelector('#cb-touch-af').checked;
            config.testMode = this.element.querySelector('#cb-test-mode').checked;
            if (this.element.querySelector('#cb-rec-mode').checked != recModeStarted) {
                toggleRecMode();
            }
            if (this.element.querySelector('#cb-live-view').checked != (liveViewSocket != null)) {
                toggleLiveview();
            }
            if (this.element.querySelector('#cb-polling').checked != eventPolling) {
                togglePolling();
            }
            saveConfig();
            refresh();
        },
        close: function() {
        }
    });

    initializeSection({id: 'help', buttonId: 'btn-help'});

    var btnRecMode = document.getElementById('btn-rec-mode');
    var btnLiveView = document.getElementById('btn-live-view');
    var btnTestLiveView = document.getElementById('btn-test-live-view');
    var btnShoot = document.getElementById('btn-shoot');
    var btnZoomIn = document.getElementById('btn-zoom-in');
    var btnZoomOut = document.getElementById('btn-zoom-out');
    var shootImage = document.getElementById("shoot-image");
    var liveViewImage = document.getElementById("liveview-image");
    var focusCircle = document.getElementById("focusCircle");
    
    var close = function() {
        console.log('closing...');
        onPageUnload();
        window.close();
    };
    var refresh = function() {
        console.log('refreshing...');
        if (config.testMode) {
            btnTestLiveView.style.display = 'inline';
            btnTestLiveView.addEventListener('click', function () {
                console.log('direct live view');
                openLiveView('http://localhost:8080/liveview/liveviewstream');
            });
        } else {
            btnTestLiveView.style.display = 'none';
        }
    };

    document.getElementById('btn-close').addEventListener('click', close);
    btnRecMode.addEventListener('click', toggleRecMode);
    btnLiveView.addEventListener('click', toggleLiveview);
    btnShoot.addEventListener('click', shoot);
    btnZoomIn.addEventListener('click', stopClick);
    btnZoomIn.addEventListener('touchstart', zoomIn);
    btnZoomIn.addEventListener('touchend', zoomCancel);
    btnZoomOut.addEventListener('click', stopClick);
    btnZoomOut.addEventListener('touchstart', zoomOut);
    btnZoomOut.addEventListener('touchend', zoomCancel);
    document.querySelector('#drawer article').addEventListener('click', onFocus);

})();