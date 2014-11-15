(function() {

    // 192.168.122.1 10.0.0.1 localhost
    var config = {
            url: 'http://192.168.122.1:8080/sony',
            autoStart: false,
            touchAF: true,
            recMode: true,
            liveView: true,
            polling: false,
            testMode: false
    };
    var discoveryAvailable = (typeof UDPSocket === 'function');

    if (document.readyState === 'complete') {
        onPageLoaded();
    } else {
        document.addEventListener('DOMContentLoaded', function loaded() {
            document.removeEventListener('DOMContentLoaded', loaded);
            onPageLoaded();
        });
    }
    window.addEventListener('unload', onPageUnload);
    
    var log = function(msg) {
        if (config.testMode) {
            console.log(msg);
        }
    };
    var logResponse = function(res) {
        log('Response:');
        log(res.getJSON());
    };

    var httpRequest = function(url, method, headers, content, callback, context) {
        if (typeof method !== 'string') {
            method = 'GET';
        }
        if (typeof headers !== 'object') {
            headers = {};
        }
        if (typeof context === 'undefined') {
            context = result;
        }
        if (typeof callback !== 'function') {
            callback = function() {};
        }
        var xhr = new XMLHttpRequest({mozSystem: true});
        xhr.open(method, url, true);
        xhr.timeout = 6000;
        for (var name in headers) {
            xhr.setRequestHeader(name, headers[name]);
        }
        var result = {
                status: xhr.status,
                xhr: xhr,
                getJSON: function() {
                    if (xhr.status === 200) { //  || xhr.status === 0
                        return JSON.parse(xhr.responseText);
                    }
                    throw 'XMLHttpRequest failed, status: ' + xhr.status;
                },
                getXML: function() {
                    if (xhr.status === 200) { //  || xhr.status === 0
                        return xhr.responseXML;
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
        xhr.onreadystatechange = function () {
            log('onreadystatechange readyState: ' + xhr.readyState);
            if (xhr.readyState !== 4) {
                return;// Not completed
            }
            callback.call(context, result);
        }
        /*xhr.onerror = function () {
            callback.call(context, result);
        };*/
        xhr.send(content);
    };

    var crSend = function(content, callback, context) {
        var url = config.url + '/camera';
        httpRequest(url, 'POST', {
            'Accept': 'application/json, text/javascript, text/plain',
            'Content-type': 'application/json; charset=UTF-8'
        }, JSON.stringify(content, null, ''), callback, context)
        
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
        log('getEvent', result);
    };
    var pollEvent = function() {
        log('pollEvent');
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
        log('toggle polling');
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
        log('startRecMode');
        progressStart();
        crSend({
            "method": "startRecMode",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            try {
                progressStop();
                recModeStarted = response.getResult() != null;
            } catch(e) {
                log('error: ' + e);
            }
            if (recModeStarted) {
                onRecMode();
            } else {
                notify('Failed to start record mode');
                if (discoveryAvailable) {
                    discover();
                }
            }
        });
    };

    var stopRecMode = function() {
        if (! recModeStarted) {
            return;
        }
        log('stopRecMode');
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
        log('toggle rec mode');
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
        log('openLiveView(' + url + ')');
        var i = url.indexOf('://') + 3;
        var j = url.indexOf('/', i);
        var fileURL = url.substring(j);
        var k = url.indexOf(':', i);
        var hostURL = url.substring(i, k);
        var portURL = parseInt(url.substring(k + 1, j));

        log('hostURL: ' + hostURL + ', portURL: ' + portURL + ', fileURL: ' + fileURL);
        liveViewSocket = navigator.mozTCPSocket.open(hostURL, portURL, {"binaryType": "arraybuffer"});
        liveViewSocket.onerror = function (event) {
            log('liveViewSocket.onerror "' + event.data + '"');
            liveViewSocket = null;
        };
        liveViewSocket.onopen = function (event) {
        try {
            log('liveViewSocket.onopen()');
            var liveViewRequest = buildHttpRequest('GET', fileURL, '', {
              "Accept": "application/json, text/javascript, text/plain",
              "Content-type": "application/json; charset=UTF-8"
            });
            var barray = strToUTF8Arr(liveViewRequest);
            log('sending ' + barray.byteLength + ' bytes...');
            /*
             * https://bugzilla.mozilla.org/show_bug.cgi?id=1057557
             * Improve error message when passing a Uint*Array to mozTCPSocket.send instead of an ArrayBuffer
             */
            //var result = liveViewSocket.send(barray, 0, barray.byteLength);
            var result = liveViewSocket.send(barray.buffer, 0, barray.byteLength);
            log('...sent ' + result + ' buffered ' + liveViewSocket.bufferedAmount);
        } catch (e) {
            log('uncaught "' + e + '"');
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
            log('onImage(), #' + sequenceNum + ', syncDelta: ' + syncDelta);
            if ((time - lasttime > 300) && (syncDelta < 1000)) {
                log('displaying...');
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
            log('ondata(' + event.data.byteLength + ')');
            try {
                processor.process(new Uint8Array(event.data));
            } catch (e) {
                log('uncaught "' + e + '"');
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
        log('live view');
        crSend({
            "method": "startLiveview",
            "params": [],
            "id": 1,
            "version": "1.0"
        }, function(response) {
            var liveViewURL = response.getResult()[0];
            log('liveViewURL "' + liveViewURL + '"');
            openLiveView(liveViewURL);
        });
    };

    var stopLiveview = function() {
        if (liveViewSocket == null) {
            return;
        }
        log('stopLiveview');
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
        log('toggle live view');
        if (liveViewSocket == null) {
            startLiveview();
        } else {
            stopLiveview();
        }
    };

    var shoot = function(event) {
        log('shooting');
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
        log('zoomStop() ' + zoomAction);
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
        log('zoomStart(' + action + ')');
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
        log('zoomCancel');
        event.stopPropagation();
        zoomStop();
    };
    var zoomIn = function(event) {
        log('zoomIn');
        event.stopPropagation();
        zoomStart("in");
    };
    var zoomOut = function(event) {
        log('zoomOut');
        event.stopPropagation();
        zoomStart("out");
    };
    
    var cancelFocus = function() {
        log('cancelFocus()');
        if (recModeStarted && config.touchAF) {
            crSend({
                "method": "cancelTouchAFPosition",
                "params": [],
                "id": 1,
                "version": "1.0"
            });
        }
    };
    
    var hideFocusCircle = function() {
        focusCircle.style.display = 'none';
    };
    var offset = document.querySelector('#drawer header').offsetHeight;
    log('offset: ' + offset);
    
    var onFocus = function(event) {
        log('onFocus()');
        var c = {
            x : event.layerX,
            y : event.layerY + offset
        };
        var point = [
            Math.round(c.x * 1000 / liveViewImage.width) / 10,
            Math.round(c.y * 1000 / liveViewImage.height) / 10
        ];
        log(point);
        if (! (recModeStarted && config.touchAF)) {
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
                // TODO need cancel?
            }
        });
    };

    var parseMessage = function(value) {
        log('parseMessage("' + value + '")');
        var obj = {};
        var lines = value.split('\r\n');
        for (var n = 0; n < lines.length; n++) {
            var line = lines[n];
            var i = line.indexOf(':');
            if (i > 0) {
                obj[line.substring(0, i)] = line.substring(i + 1);
            }
        }
        return obj;
    };

    var onDiscoveryFailure = function(msg) {
        progressStop();
        notify('Fail to discover URL: ' + msg);
    };

    var onDiscoveryLocation = function(location) {
        log('onDiscoveryLocation(' + location + ')');
        httpRequest(location, 'GET', {
            'Accept': 'text/xml'
        }, null, function(response) {
            log('...onDiscoveryLocation()');
            var xml = response.getXML();
            log(xml);
            var url = null;
            var namespace = 'urn:schemas-sony-com:av';
            var services = xml.getElementsByTagNameNS(namespace, 'X_ScalarWebAPI_Service');
            log('services.length: ' + services.length);
            for (var i = 0; i < services.length; i++) {
                var service = services[i];
                var serviceType = service.getElementsByTagNameNS(namespace, 'X_ScalarWebAPI_ServiceType')[0].textContent;
                var actionListURL = service.getElementsByTagNameNS(namespace, 'X_ScalarWebAPI_ActionList_URL')[0].textContent;
                if (serviceType == 'camera') {
                    url = actionListURL;
                    break;
                }
            }
            if (url !== null) {
                log(url);
                config.url = url;
                saveConfig();
                notify('URL discovered');
                progressStop();
                document.getElementById('pref').querySelector('#url').value = config.url;
            } else {
                onDiscoveryFailure('bad device description');
            }
        })
    };

    var discover = function(event) {
        log('discover()');
        progressStart();
        try {
            /*
             * See https://bugzilla.mozilla.org/show_bug.cgi?id=745283
             * and https://bugzilla.mozilla.org/attachment.cgi?id=8478762&action=diff
             */
            var discoverySocket = new UDPSocket();
            if (! discoverySocket) {
                throw 'failed to open discoverySocket';
            }
            //socket.joinMulticastGroup('224.0.0.255'); socket.leaveMulticastGroup('224.0.0.255');
            log('discoverySocket created, readyState is ' + discoverySocket.readyState);

            var onDiscoveryMessage = function (msg) {
                log('onDiscoveryMessage(' + msg.data + ') ' + msg.remotePort + ', ' + discoverySocket.localPort);
                
                var barray = new Uint8Array(msg.data);
                log('barray.length: ' + barray.length);
                //var recvData = String.fromCharCode.apply(null, barray);
                var recvData = UTF8ArrToStr(barray);
                var obj = parseMessage(recvData);
                log(obj);
                log('USN "' + obj['USN'] + '"');
                if ('LOCATION' in obj) {
                    discoverySocket.removeEventListener('message', onDiscoveryMessage);
                    closeDiscovery();
                    onDiscoveryLocation(obj['LOCATION']);
                }
            };
            var closeDiscovery = function () {
                log('closeDiscovery()');
                if (discoverySocket != null) {
                    try {
                        discoverySocket.close();
                    } finally {
                        discoverySocket = null;
                    }
                }
            };
            var onDiscoveryError = function () {
                log('onDiscoveryError()');
                closeDiscovery();
                onDiscoveryFailure('cannot open socket');
            };
            var sendDiscoveryRequest = function () {
                log('discoverySocket opened, readyState is ' + discoverySocket.readyState);
                var address = '239.255.255.250';
                var port = 1900;
                // address = '192.168.0.11'; port = 9876;
                var discoveryRequest = buildHttpRequest('M-SEARCH', '*', '', {
                    HOST: address + ':' + port,
                    MAN: '"ssdp:discover"',
                    MX: 1,
                    ST: 'urn:schemas-sony-com:service:ScalarWebAPI:1'
                }, '1.1');
                log('discoverySocket.send("' + discoveryRequest + '", ' + address + ', ' + port + ')');
                discoverySocket.send(discoveryRequest, address, port);
            };
            
            discoverySocket.addEventListener('message', onDiscoveryMessage);
            discoverySocket.opened.then(sendDiscoveryRequest, onDiscoveryError);
            
            window.setTimeout(function() {
                log("Timeout reached. Closing the discoverySocket");
                if (discoverySocket != null) {
                    onDiscoveryFailure('timeout');
                }
                closeDiscovery();
            }, 6000);
        } catch (e) {
            log("Got an exception " + e);
            log(e);
            onDiscoveryFailure('error ' + e);
        }		
    };

    var onRecMode = function() {
        notify('Record mode started');
        btnShoot.style.display = 'inline';
        btnZoomIn.style.display = 'inline';
        btnZoomOut.style.display = 'inline';
        if (config.liveView != (liveViewSocket != null)) {
            toggleLiveview();
        }
        if (config.polling != eventPolling) {
            togglePolling();
        }
    };

    var startAll = function() {
        log('startAll()');
        startRecMode();
    };

    var onPageLoaded = function() {
        log('onPageLoaded()');
        if (config.autoStart) {
            startAll();
        }
    };

    var stopAll = function() {
        log('stopAll()');
        cancelFocus();
        stopRecMode();
        stopLiveview();
        stopPolling();
    };

    var onPageUnload = function() {
        log('onPageUnload()');
        stopAll();
    };

    initializeSection({
        id: 'pref',
        buttonId: 'btn-pref',
        open: function() {
            this.element.querySelector('#url').value = config.url;
            this.element.querySelector('#cb-auto-start').checked = config.autoStart;
            this.element.querySelector('#cb-live-view').checked = config.liveView;
            this.element.querySelector('#cb-rec-mode').checked = config.recMode;
            this.element.querySelector('#cb-polling').checked = config.polling;
            this.element.querySelector('#cb-touch-af').checked = config.touchAF;
            this.element.querySelector('#cb-test-mode').checked = config.testMode;
        },
        confirm: function() {
            config.url = this.element.querySelector('#url').value;
            config.autoStart = this.element.querySelector('#cb-auto-start').checked;
            config.touchAF = this.element.querySelector('#cb-touch-af').checked;
            config.testMode = this.element.querySelector('#cb-test-mode').checked;
            config.recMode = this.element.querySelector('#cb-rec-mode').checked;
            config.liveView = this.element.querySelector('#cb-live-view').checked;
            config.polling = this.element.querySelector('#cb-polling').checked;
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
    var btnTestLiveLocation = document.getElementById('btn-test-location');
    var btnShoot = document.getElementById('btn-shoot');
    var btnZoomIn = document.getElementById('btn-zoom-in');
    var btnZoomOut = document.getElementById('btn-zoom-out');
    var shootImage = document.getElementById("shoot-image");
    var liveViewImage = document.getElementById("liveview-image");
    var focusCircle = document.getElementById("focusCircle");
    var btnDiscover = document.getElementById('btn-discover');
    var progressMain = document.getElementById("progress-main");
    
    var progressStop = function() {
        progressMain.style.display = 'none';
    };
    var progressStart = function() {
        progressMain.style.display = 'block';
    };
    var close = function() {
        log('closing...');
        onPageUnload();
        window.close();
    };
    var refresh = function() {
        log('refreshing...');
        if (config.testMode) {
            btnTestLiveView.style.display = 'inline';
            btnTestLiveLocation.style.display = 'inline';
        } else {
            btnTestLiveView.style.display = 'none';
            btnTestLiveLocation.style.display = 'none';
        }
    };

    document.getElementById('btn-start').addEventListener('click', startAll);
    document.getElementById('btn-stop').addEventListener('click', stopAll);
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
    
    btnTestLiveLocation.addEventListener('click', function() {
        //onDiscoveryLocation('http://192.168.122.1:61000/scalarwebapi_dd.xml');
        onDiscoveryLocation('http://localhost:8080/www/scalarwebapi_dd.xml');
    });
    btnTestLiveView.addEventListener('click', function () {
        log('direct live view');
        openLiveView('http://localhost:8080/liveview/liveviewstream');
    });

    if (discoveryAvailable) {
        btnDiscover.addEventListener('click', discover);
    } else {
        btnDiscover.style.display = 'none';
    }
    refresh();
    progressStop(); // app is successfully loaded
    
})();