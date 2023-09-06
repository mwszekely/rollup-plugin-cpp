(function () {
    'use strict';

    Promise.withResolvers ??= () => {
        let resolve;
        let reject;
        let promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        return {
            promise,
            resolve,
            reject,
        };
    };

    async function decodeAssetShared(response, action, backup) {
    	if ("then" in response) {
    		return await decodeAssetShared(await response, action, backup);
    	}
    	if (response.ok) {
    		return await action(await response);
    	}
    	if (backup != null)
    		return await backup;

    	throw new Error("Critical error: could not load file: HTTP response " + response.status);
    }

    async function decodeAssetResponse(response) {
    	return await decodeAssetShared(response, r => r, response);
    }

    decodeAssetResponse(fetch("assets/default.wasm"));

    // Did you know that Event isn't defined in Worklets in Firefox and possibly other environments? Even more fun!!
    globalThis.Event ??= class Event {
        constructor(type_, eventInitDict) {
            this.bubbles = eventInitDict?.bubbles || false;
            this.cancelBubble = false;
            this.cancelable = eventInitDict?.cancelable || false;
            this.composed = eventInitDict?.composed || false;
            this.currentTarget = null;
            this.defaultPrevented = false;
            this.eventPhase = Event.NONE;
            this.isTrusted = true;
            this.returnValue = false;
            this.srcElement = null;
            this.target = null;
            this.timeStamp = 0;
            this.type = type_;
        }
        static NONE = 0;
        static CAPTURING_PHASE = 1;
        static AT_TARGET = 2;
        static BUBBLING_PHASE = 3;
        /**
         * Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)
         */
        bubbles;
        /**
         * @deprecated
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)
         */
        cancelBubble;
        /**
         * Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)
         */
        cancelable;
        /**
         * Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)
         */
        composed;
        /**
         * Returns the object whose event listener's callback is currently being invoked.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)
         */
        currentTarget;
        /**
         * Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)
         */
        defaultPrevented;
        /**
         * Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)
         */
        eventPhase;
        /**
         * Returns true if event was dispatched by the user agent, and false otherwise.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)
         */
        isTrusted;
        /**
         * @deprecated
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)
         */
        returnValue;
        /**
         * @deprecated
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)
         */
        srcElement;
        /**
         * Returns the object to which event is dispatched (its target).
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)
         */
        target;
        /**
         * Returns the event's timestamp as the number of milliseconds measured relative to the time origin.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)
         */
        timeStamp;
        /**
         * Returns the type of event, e.g. "click", "hashchange", or "submit".
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)
         */
        type;
        /**
         * Returns the invocation target objects of event's path (objects on which listeners will be invoked), except for any nodes in shadow trees of which the shadow root's mode is "closed" that are not reachable from event's currentTarget.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)
         */
        composedPath() { return []; }
        /**
         * @deprecated
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)
         */
        initEvent(type_, bubbles, cancelable) { this.type = type_; this.bubbles = bubbles || this.bubbles; this.cancelable = cancelable || this.cancelable; }
        /**
         * If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)
         */
        preventDefault() { this.defaultPrevented = true; }
        /**
         * Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)
         */
        stopImmediatePropagation() { }
        /**
         * When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)
         */
        stopPropagation() { }
    };

    // Did you know that CustomEvent isn't defined in Worklets? Fun!!
    globalThis.CustomEvent ??= class CustomEvent extends Event {
        constructor(type, eventInitDict) {
            super(type, eventInitDict);
            this.detail = eventInitDict?.detail;
        }
        /**
         * Returns any custom data event was created with. Typically used for synthetic events.
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent/detail)
         */
        detail;
        /**
         * @deprecated
         *
         * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent/initCustomEvent)
         */
        initCustomEvent(type, bubbles, cancelable, detail) {
            this.detail = (detail ?? this.detail);
        }
    };

    var errorno;
    (function (errorno) {
        errorno[errorno["success"] = 0] = "success";
        errorno[errorno["toobig"] = 1] = "toobig";
        errorno[errorno["acces"] = 2] = "acces";
        errorno[errorno["addrinuse"] = 3] = "addrinuse";
        errorno[errorno["addrnotavail"] = 4] = "addrnotavail";
        errorno[errorno["afnosupport"] = 5] = "afnosupport";
        errorno[errorno["again"] = 6] = "again";
        errorno[errorno["already"] = 7] = "already";
        errorno[errorno["badf"] = 8] = "badf";
        errorno[errorno["badmsg"] = 9] = "badmsg";
        errorno[errorno["busy"] = 10] = "busy";
        errorno[errorno["canceled"] = 11] = "canceled";
        errorno[errorno["child"] = 12] = "child";
        errorno[errorno["connaborted"] = 13] = "connaborted";
        errorno[errorno["connrefused"] = 14] = "connrefused";
        errorno[errorno["connreset"] = 15] = "connreset";
        errorno[errorno["deadlk"] = 16] = "deadlk";
        errorno[errorno["destaddrreq"] = 17] = "destaddrreq";
        errorno[errorno["dom"] = 18] = "dom";
        errorno[errorno["dquot"] = 19] = "dquot";
        errorno[errorno["exist"] = 20] = "exist";
        errorno[errorno["fault"] = 21] = "fault";
        errorno[errorno["fbig"] = 22] = "fbig";
        errorno[errorno["hostunreach"] = 23] = "hostunreach";
        errorno[errorno["idrm"] = 24] = "idrm";
        errorno[errorno["ilseq"] = 25] = "ilseq";
        errorno[errorno["inprogress"] = 26] = "inprogress";
        errorno[errorno["intr"] = 27] = "intr";
        errorno[errorno["inval"] = 28] = "inval";
        errorno[errorno["io"] = 29] = "io";
        errorno[errorno["isconn"] = 30] = "isconn";
        errorno[errorno["isdir"] = 31] = "isdir";
        errorno[errorno["loop"] = 32] = "loop";
        errorno[errorno["mfile"] = 33] = "mfile";
        errorno[errorno["mlink"] = 34] = "mlink";
        errorno[errorno["msgsize"] = 35] = "msgsize";
        errorno[errorno["multihop"] = 36] = "multihop";
        errorno[errorno["nametoolong"] = 37] = "nametoolong";
        errorno[errorno["netdown"] = 38] = "netdown";
        errorno[errorno["netreset"] = 39] = "netreset";
        errorno[errorno["netunreach"] = 40] = "netunreach";
        errorno[errorno["nfile"] = 41] = "nfile";
        errorno[errorno["nobufs"] = 42] = "nobufs";
        errorno[errorno["nodev"] = 43] = "nodev";
        errorno[errorno["noent"] = 44] = "noent";
        errorno[errorno["noexec"] = 45] = "noexec";
        errorno[errorno["nolck"] = 46] = "nolck";
        errorno[errorno["nolink"] = 47] = "nolink";
        errorno[errorno["nomem"] = 48] = "nomem";
        errorno[errorno["nomsg"] = 49] = "nomsg";
        errorno[errorno["noprotoopt"] = 50] = "noprotoopt";
        errorno[errorno["nospc"] = 51] = "nospc";
        errorno[errorno["nosys"] = 52] = "nosys";
        errorno[errorno["notconn"] = 53] = "notconn";
        errorno[errorno["notdir"] = 54] = "notdir";
        errorno[errorno["notempty"] = 55] = "notempty";
        errorno[errorno["notrecoverable"] = 56] = "notrecoverable";
        errorno[errorno["notsock"] = 57] = "notsock";
        errorno[errorno["notsup"] = 58] = "notsup";
        errorno[errorno["notty"] = 59] = "notty";
        errorno[errorno["nxio"] = 60] = "nxio";
        errorno[errorno["overflow"] = 61] = "overflow";
        errorno[errorno["ownerdead"] = 62] = "ownerdead";
        errorno[errorno["perm"] = 63] = "perm";
        errorno[errorno["pipe"] = 64] = "pipe";
        errorno[errorno["proto"] = 65] = "proto";
        errorno[errorno["protonosupport"] = 66] = "protonosupport";
        errorno[errorno["prototype"] = 67] = "prototype";
        errorno[errorno["range"] = 68] = "range";
        errorno[errorno["rofs"] = 69] = "rofs";
        errorno[errorno["spipe"] = 70] = "spipe";
        errorno[errorno["srch"] = 71] = "srch";
        errorno[errorno["stale"] = 72] = "stale";
        errorno[errorno["timedout"] = 73] = "timedout";
        errorno[errorno["txtbsy"] = 74] = "txtbsy";
        errorno[errorno["xdev"] = 75] = "xdev";
        errorno[errorno["notcapable"] = 76] = "notcapable";
    })(errorno || (errorno = {}));

    // An alias for instance.exports
    let allExports;

    // This is a promise that resolves to the WASM module **before WASI is initialized**.
    // WASI needs it to initialize itself; it shouldn't be used for any other purpose.
    Promise.withResolvers();

    const utf16Decoder = new TextDecoder("utf-16");
    function readStrC16(buffer, ptr, maxLength = -1) {
        if (maxLength == -1) {
            maxLength = allExports.strLenC16(ptr);
        }
        return utf16Decoder.decode(new DataView(buffer, ptr, maxLength));
    }

    /*
    import "./core/src/BarcodeFormat.cpp";
    import "./core/src/BinaryBitmap.cpp";
    import "./core/src/BitArray.cpp";
    import "./core/src/BitMatrix.cpp";
    import "./core/src/BitMatrixIO.cpp";
    import "./core/src/BitSource.cpp";
    import "./core/src/CharacterSet.cpp";
    import "./core/src/ConcentricFinder.cpp";
    import "./core/src/Content.cpp";
    import "./core/src/DecodeHints.cpp";
    import "./core/src/ECI.cpp";
    import "./core/src/GTIN.cpp";
    import "./core/src/GenericGF.cpp";
    import "./core/src/GenericGFPoly.cpp";
    import "./core/src/GlobalHistogramBinarizer.cpp";
    import "./core/src/GridSampler.cpp";
    import "./core/src/HRI.cpp";
    import "./core/src/HybridBinarizer.cpp";
    import "./core/src/MultiFormatReader.cpp";
    import "./core/src/MultiFormatWriter.cpp";
    import "./core/src/PerspectiveTransform.cpp";
    import "./core/src/ReadBarcode.cpp";
    import "./core/src/ReedSolomonDecoder.cpp";
    import "./core/src/ReedSolomonEncoder.cpp";
    import "./core/src/Result.cpp";
    import "./core/src/ResultPoint.cpp";
    import "./core/src/TextDecoder.cpp";
    import "./core/src/TextEncoder.cpp";
    import "./core/src/TextUtfEncoding.cpp";
    import "./core/src/Utf.cpp";
    import "./core/src/WhiteRectDetector.cpp";
    import "./core/src/ZXBigInteger.cpp";
    import "./core/src/aztec/AZDecoder.cpp";
    import "./core/src/aztec/AZDetector.cpp";
    import "./core/src/aztec/AZEncoder.cpp";
    import "./core/src/aztec/AZHighLevelEncoder.cpp";
    import "./core/src/aztec/AZReader.cpp";
    import "./core/src/aztec/AZToken.cpp";
    import "./core/src/aztec/AZWriter.cpp";
    import "./core/src/datamatrix/DMBitLayout.cpp";
    import "./core/src/datamatrix/DMDataBlock.cpp";
    import "./core/src/datamatrix/DMDecoder.cpp";
    import "./core/src/datamatrix/DMDetector.cpp";
    import "./core/src/datamatrix/DMECEncoder.cpp";
    import "./core/src/datamatrix/DMHighLevelEncoder.cpp";
    import "./core/src/datamatrix/DMReader.cpp";
    import "./core/src/datamatrix/DMSymbolInfo.cpp";
    import "./core/src/datamatrix/DMVersion.cpp";
    import "./core/src/datamatrix/DMWriter.cpp";
    import "./core/src/libzueci/zueci.c";
    import "./core/src/maxicode/MCBitMatrixParser.cpp";
    import "./core/src/maxicode/MCDecoder.cpp";
    import "./core/src/maxicode/MCReader.cpp";
    import "./core/src/oned/ODCodabarReader.cpp";
    import "./core/src/oned/ODCodabarWriter.cpp";
    import "./core/src/oned/ODCode128Patterns.cpp";
    import "./core/src/oned/ODCode128Reader.cpp";
    import "./core/src/oned/ODCode128Writer.cpp";
    import "./core/src/oned/ODCode39Reader.cpp";
    import "./core/src/oned/ODCode39Writer.cpp";
    import "./core/src/oned/ODCode93Reader.cpp";
    import "./core/src/oned/ODCode93Writer.cpp";
    import "./core/src/oned/ODDataBarCommon.cpp";
    import "./core/src/oned/ODDataBarExpandedBitDecoder.cpp";
    import "./core/src/oned/ODDataBarExpandedReader.cpp";
    import "./core/src/oned/ODDataBarReader.cpp";
    import "./core/src/oned/ODEAN13Writer.cpp";
    import "./core/src/oned/ODEAN8Writer.cpp";
    import "./core/src/oned/ODITFReader.cpp";
    import "./core/src/oned/ODITFWriter.cpp";
    import "./core/src/oned/ODMultiUPCEANReader.cpp";
    import "./core/src/oned/ODReader.cpp";
    import "./core/src/oned/ODRowReader.cpp";
    import "./core/src/oned/ODUPCAWriter.cpp";
    import "./core/src/oned/ODUPCEANCommon.cpp";
    import "./core/src/oned/ODUPCEWriter.cpp";
    import "./core/src/oned/ODWriterHelper.cpp";
    import "./core/src/pdf417/PDFBarcodeValue.cpp";
    import "./core/src/pdf417/PDFBoundingBox.cpp";
    import "./core/src/pdf417/PDFCodewordDecoder.cpp";
    import "./core/src/pdf417/PDFDecoder.cpp";
    import "./core/src/pdf417/PDFDetectionResult.cpp";
    import "./core/src/pdf417/PDFDetectionResultColumn.cpp";
    import "./core/src/pdf417/PDFDetector.cpp";
    import "./core/src/pdf417/PDFEncoder.cpp";
    import "./core/src/pdf417/PDFHighLevelEncoder.cpp";
    import "./core/src/pdf417/PDFModulusGF.cpp";
    import "./core/src/pdf417/PDFModulusPoly.cpp";
    import "./core/src/pdf417/PDFReader.cpp";
    import "./core/src/pdf417/PDFScanningDecoder.cpp";
    import "./core/src/pdf417/PDFWriter.cpp";
    import "./core/src/qrcode/QRBitMatrixParser.cpp";
    import "./core/src/qrcode/QRCodecMode.cpp";
    import "./core/src/qrcode/QRDataBlock.cpp";
    import "./core/src/qrcode/QRDecoder.cpp";
    import "./core/src/qrcode/QRDetector.cpp";
    import "./core/src/qrcode/QREncoder.cpp";
    import "./core/src/qrcode/QRErrorCorrectionLevel.cpp";
    import "./core/src/qrcode/QRFormatInformation.cpp";
    import "./core/src/qrcode/QRMaskUtil.cpp";
    import "./core/src/qrcode/QRMatrixUtil.cpp";
    import "./core/src/qrcode/QRReader.cpp";
    import "./core/src/qrcode/QRVersion.cpp";
    import "./core/src/qrcode/QRWriter.cpp";
    */
    (async () => {
        await allExports.__untilReady();
        let ptr = allExports.bar2();
        let str = readStrC16(allExports.__memory.buffer, ptr);
        console.log(str);
        allExports.foo();
    })();

})();
