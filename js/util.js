var _inheritsFrom = (function () {
    function subClass() {};
    return function(clazz, superClass) {
        subClass.prototype = superClass.prototype;
        clazz.prototype = new subClass();
        clazz.prototype.constructor = clazz;
        // clazz.superClass.call(this, ... superClass constructor args);
        clazz.superClass = superClass;
    };
})();

var hashString = function(value) {
    var hash = 0;
    for (var i = 0; i < value.length; i++) {
        hash = ((hash << 5) - hash) + value.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

var lastIndexOf = function(array, item) {
    var i = array.length;
    while (--i >= 0) {
        if (array[i] === item) {
            break;
        }
    }
    return i;
};

var removeItem = function(array, item) {
    for (var i = 0; i < array.length; i++) {
        if (item === array[i]) {
            array.splice(i, 1);
            return true;
        }
    }
    return false;
};

var removeAllChildren = function(elem) {
    if (typeof elem === 'string') {
        elem = document.querySelector(elem);
    }
    while (elem.firstChild) {
        elem.removeChild(elem.firstChild);
    }
};

var createElement = function(options, parent) {
    if (typeof options == 'string') {
        options = {
                name: options
        };
    } else if ((typeof options != 'object') || (! ('name' in options))) {
        throw 'Invalid options argument';
    }
    var elem = document.createElement(options.name);
    if ('text' in options) {
        elem.appendChild(document.createTextNode(options.text));
    }
    if ('attributes' in options) {
        for (var k in options.attributes) {
            var v = options.attributes[k];
            switch (k) {
            case 'class':
                elem.className = v;
                break;
            default:
                elem.setAttribute(k, v);
                break;
            }
        }
    }
    if ('children' in options) {
        for (var i = 0; i < options.children.length; i++) {
            createElement(options.children[i], elem);
        }
    }
    if (typeof parent != 'undefined') {
        parent.appendChild(elem);
    }
    return elem;
};

var setTextContent = function(elem, value) {
    if (typeof elem === 'string') {
        elem = document.querySelector(elem);
    }
    elem && elem.appendChild(document.createTextNode(value));
};

var getTextContent = function(elem) {
    if (typeof elem === 'string') {
        elem = document.querySelector(elem);
    }
    if ((elem != null) && (elem.firstChild.nodeType == 3)) {
        return elem.firstChild.nodeValue;
    }
    return '';
};

var getRelativeCoords = function(event, elem) {
    return {
        x : event.layerX,
        y : event.layerY
    };
};

var xmlEscape = function(s) {
    if (s) {
        return s.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').
            replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\n/g, '&#x000a;').replace(/\t/g, '&#x0009;');
    }
    return s;
};

var invokeLater = function(f, ms) {
    return function() {
        window.setTimeout(f, ms);
    };
};

var fetchFromStore = function(key, defaultValue) {
    var value = window.localStorage.getItem(key);
    if (value == null) {
        return defaultValue;
    }
    return JSON.parse(value);
};
var putInStore = function(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value, null, ''));
};

var getSliderValue = function(elem) {
    if (typeof elem === 'string') {
        elem = document.querySelector(elem);
    }
    return parseFloat(elem.getAttribute('aria-valuenow'));
};

var notify = function(message) {
    //console.log('notify("' + message + '")');
    utils.status.show(message);    
};

var fireEvent = function(options, name, vis, arg, defaultValue) {
    if (options && (name in options)) {
        var fn = options[name];
        if (typeof fn === 'function') {
            var res = fn.call(vis || options, arg || undefined);
            if (typeof res !== 'undefined') {
                return res;
            }
        }
    }
    return defaultValue;
};

var initializeSection = function(options) {
    var element = document.querySelector('#' + options.id);
    if (element == null) {
        console.log('section "' + options.id + '" not found');
        return;
    }
    var section = {
        element: element,
        options: options
    };
    var confirmBtn = element.querySelector('#confirm');
    var mode = '';
    section.open = function (event) {
        var targetElement = event.target || event.srcElement;
        if (targetElement && targetElement.hasAttribute('mode')) {
            mode = targetElement.getAttribute('mode');
        } else {
            mode = '';
        }
        if (fireEvent(options, 'open' + mode, section, undefined, true)) {
            element.className = 'current';
            document.querySelector('[data-position="current"]').className = 'left';
            fireEvent(options, 'opened' + mode, section);
        }
    };
    if ('buttonId' in options) {
        var openBtn = document.querySelector('#' + options.buttonId);
        openBtn.addEventListener('click', section.open);
    }
    fireEvent(options, 'init', section);
    var backBtn = element.querySelector('#back');
    backBtn && backBtn.addEventListener ('click', function () {
        element.className = 'right';
        document.querySelector('[data-position="current"]').className = 'current';
        fireEvent(options, 'close' + mode, section);
    });
    confirmBtn && confirmBtn.addEventListener ('click', function () {
        element.className = 'right';
        document.querySelector('[data-position="current"]').className = 'current';
        fireEvent(options, 'confirm' + mode, section);
    });
    return section;
};

var fillSelect = function(elem, array) {
    var b;
    var menu = elem.querySelector('menu');
    removeAllChildren(menu);
    for (var i = 0; array && (i < array.length); i++) {
        b = document.createElement('button');
        setTextContent(b, array[i].name);
        b.setAttribute('index', i);
        menu.appendChild(b);
    }
    b = document.createElement('button');
    setTextContent(b, 'Cancel');
    b.setAttribute('index', -1);
    menu.appendChild(b);
};

var getSelectedIndex = function(elem) {
    var i = -1;
    if (elem) {
        i = parseInt(elem.getAttribute('index'), 10);
    }
    return i;
};

var initializeSelect = function(options) {
    var element = document.querySelector('#' + options.id);
    if (element == null) {
        console.log('section "' + options.id + '" not found');
        return;
    }
    var section = {
        element: element,
        options: options
    };
    section.open = function() {
        if (fireEvent(options, 'open', section, undefined, true)) {
            element.className = 'fade-in';
        }
    };
    fireEvent(options, 'init', section);
    if ('buttonId' in options) {
        var openBtn = document.querySelector('#' + options.buttonId);
        openBtn.addEventListener('click', section.open);
    }
    element.addEventListener('click', function (event) {
        console.log('initializeSelect() clicked');
        this.className = 'fade-out';
        var targetElement = event.target || event.srcElement;
        fireEvent(options, 'close', section, targetElement);
    });
    return section;
};

var buildHttpRequest = function(method, path, content, header, version) {
    var body = '';
    if (typeof content === 'string') {
        body = content;
    } else if (typeof content === 'object') {
        body = JSON.stringify(content, null, '');
    } else {
        body = '';
    }
    if (typeof header === 'undefined') {
        header = {};
    }
    if (typeof version === 'undefined') {
        version = '1.0';
    }
    var buffer = method + ' ' + path + ' HTTP/' + version + '\r\n';
    if (body.length > 0) {
        header['Content-Length'] = '' + body.length;
    }
    for (var key in header) {
        buffer += key + ': ' + header[key] + '\r\n';
    }
    buffer += '\r\n';
    buffer += body;
    return buffer
};

var asciiToBarray = function(value) {
    var barray = new Uint8Array(value.length);
    for (var i = 0; i < value.length; i++) {
        barray[i] = value.charCodeAt(i)
    }
    return barray;
};

var logBarray = function(barray, size) {
    var buffer = '';
    var s, h;
    for (var i = 0; i < size; i++) {
        var b = barray[i];
        if (i % 16 == 0) {
          if (i > 0)
            buffer += s + ' ' + h + '\n';
          s = '';
          h = '';
        }
        s += ((b > 32) && (b < 128)) ? String.fromCharCode(b) : ' ';
        h += (b > 15 ? '' : '0') + b.toString(16);
    }
    console.log(buffer);
};

var LogProcessor = function() {
};
LogProcessor.prototype.process = function(barray) {
    logBarray(barray, barray.length);
};
var HttpHeaderProcessor = function(nextProcessor) {
    this.nextProcessor = nextProcessor;
    this._httpState = 0;
    this._buffer = '';
};
HttpHeaderProcessor.prototype.process = function(barray) {
    if (this._httpState < 4) {
        for (var index = 0; ; index++) {
            if (index >= barray.length) {
                return;
            }
            if (this._httpState == 4) {
                break;
            }
            if (((barray[index] == 13) && ((this._httpState == 0) || (this._httpState == 2))) ||
                ((barray[index] == 10) && ((this._httpState == 1) || (this._httpState == 3))))
            {
                this._httpState++;
            } else {
                this._httpState = 0;
            }
            this._buffer += String.fromCharCode(barray[index]);
        }
        barray = barray.subarray(index);
        console.log('HTTP Header >' + this._buffer + '<');
    }
    // TODO Check response code
    this.nextProcessor.process(barray);
};
var HttpChunkProcessor = function(nextProcessor) {
    this.nextProcessor = nextProcessor;
    this._httpState = 2;
    this._chunkSize = 0;
    this._buffer = '';
};
HttpChunkProcessor.prototype.process = function(barray) {
    //console.log('HttpChunkProcessor() ' + barray.length);
    var index = 0;
    while (index < barray.length) {
        //console.log('index: ' + index + '/' + barray.length + ', state: ' + this._httpState);
        if (this._httpState < 4) {
            for (; ; index++) {
                if (index >= barray.length) {
                    return;
                }
                if (this._httpState >= 4) {
                    break;
                }
                switch (this._httpState) {
                case 0:
                    if (barray[index] != 13) {
                        throw 'Bad chunk: first CR expected (0x' + barray[index].toString(16) + ')';
                    }
                    this._httpState++;
                    break;
                case 1:
                    if (barray[index] != 10) {
                        throw 'Bad chunk: first NL expected (0x' + barray[index].toString(16) + ')';
                    }
                    this._httpState++;
                    break;
                case 2:
                    if (barray[index] != 13) {
                        this._buffer += String.fromCharCode(barray[index]);
                    } else {
                        this._httpState++;
                    }
                    break;
                case 3:
                    if (barray[index] != 10) {
                        throw 'Bad chunk: second NL expected (0x' + barray[index].toString(16) + ')';
                    }
                    this._httpState++;
                    this._chunkSize = parseInt(this._buffer.split(';'), 16);
                    //console.log('chunkSize: ' + this._chunkSize + ' >' + this._buffer + '<');
                    this._buffer = '';
                    break;
                }
            }
        }
        var cbarray = null;
        var endIndex = index + this._chunkSize;
        if (barray.length > endIndex) {
            cbarray = barray.subarray(index, endIndex);
        } else {
            cbarray = barray.subarray(index);
        }
        this._chunkSize -= cbarray.length;
        index += cbarray.length;
        //console.log('to process: ' + cbarray.length);
        this.nextProcessor.process(cbarray);
        if (this._chunkSize == 0) {
            this._httpState = 0;
        }
        //console.log('remaining chunkSize: ' + this._chunkSize);
    }
};
var HttpLiveviewProcessor = function(onImageFn) {
    this.onImageFn = onImageFn;
    this.state = 0;
    this.ba = new Uint8Array(62000);
    this.baIndex = 0;
    this.baLimit = 136;
    this.jpegSize = 0;
    this.paddingSize = 0;
    this.sequenceNum = 0;
    this.timestamp = 0;
};
HttpLiveviewProcessor.prototype.process = function(barray) {
    var index = 0;
    while (index < barray.length) {
        // append buffer until limit is reached
        var count = barray.length - index;
        var remaining = this.baLimit - this.baIndex;
        if (count > remaining) {
            count = remaining;
        }
        //console.log('index: ' + index + '/' + barray.length + ', state: ' + this.state + ', ' + this.baIndex + ' + ' + count + '/' + this.baLimit);
        this.ba.set(barray.subarray(index, index + count), this.baIndex);
        index += count;
        this.baIndex += count;
        if (this.baIndex < this.baLimit) {
            break;
        } // else limit reached
        this.baIndex = 0;
        switch (this.state) {
        case 0: // headers
            var commonHeaderView = new DataView(this.ba.buffer, 0, 8);
            if (commonHeaderView.getUint8(0) != 255) {
              logBarray(this.ba, this.baLimit);
              throw 'Invalid start byte (0x' + commonHeaderView.getUint8(0).toString(16) + ')';
            }
            if (commonHeaderView.getUint8(1) != 1) {
              logBarray(this.ba, this.baLimit);
              throw 'Payload type is not liveview images (0x' + commonHeaderView.getUint8(1).toString(16) + ')';
            }
            this.sequenceNum = commonHeaderView.getUint16(2);
            this.timestamp = commonHeaderView.getUint32(4);
            var payloadHeaderView = new DataView(this.ba.buffer, 8, 128);
            if ((payloadHeaderView.getUint8(0) != 0x24) ||
                (payloadHeaderView.getUint8(1) != 0x35) ||
                (payloadHeaderView.getUint8(2) != 0x68) ||
                (payloadHeaderView.getUint8(3) != 0x79))
            {
              logBarray(this.ba, this.baLimit);
              throw 'Invalid start code';
            }
            this.jpegSize = (payloadHeaderView.getUint8(4) << 16) +
                       (payloadHeaderView.getUint8(5) << 8) +
                       payloadHeaderView.getUint8(6);
            this.paddingSize = payloadHeaderView.getUint8(7);
            //console.log('size: ' + this.jpegSize + ', padding: ' + this.paddingSize);
            if (this.jpegSize > this.ba.byteLength) {
              throw 'buffer too small';
            }
            this.baLimit = this.jpegSize;
            this.state++;
            break;
        case 1: // jpeg
            var payloadDataView = new Uint8Array(this.ba.buffer, 0, this.baLimit);
            if ((payloadDataView[0] != 0xff) ||
                (payloadDataView[1] != 0xd8) ||
                (payloadDataView[2] != 0xff) ||
                (payloadDataView[3] != 0xdb))
            {
              throw 'Invalid jpeg (' + arrToHex(payloadDataView, 0, 16) + ')';
            }
            this.onImageFn(payloadDataView, this.sequenceNum, this.timestamp);
            if (this.paddingSize > 0) {
                this.baLimit = this.paddingSize;
                this.state++;
                break;
            }
        case 2: // padding
            this.baLimit = 136;
            this.state = 0;
            break;
        }
    }
};

