/*jshint esversion: 9 */
class CommunicationBridge {
    constructor() {
        this.target = null;
        this.initOptions = null;
        this.queue = [];
    }

    requestAction(action, ...values) {
        if (action == 'init') {
            this.initOptions = (values && values[0]) || null;
        }

        if (this.target) {
            let returnValue = this.target._handleNativeCall(action, ...values);
            if (action == 'init') {
                this._onInitialized();
            }
            return returnValue;
        } else {
            this.queue.push({ action: action, values: values });
        }
    }

    requestActionAsync(action, returnEvent, ...values) {
        if (this.target) {
            let returnValue = this.target._handleNativeCall(action, ...values);
            if (returnValue && ('then' in returnValue)) {
                returnValue.then((value) => {
                    this._dispatchEvent(returnEvent, value || {});
                });
            } else {
                this._dispatchEvent(returnEvent, returnValue || {});
            }
            return returnValue;
        } else {
            this.queue.push({ action: action, values: [returnEvent, ...values], isAsync: true });
        }
    }

    setDisplayTarget(newTarget) {
        this.target = newTarget;
        if (this.initOptions) {
            this.target._handleNativeCall('init', ...[this.initOptions]);
            this._onInitialized();
        }
        while (this.queue.length > 0) {
            let cmd = this.queue.shift();
            if (cmd.action !== 'init') {
                if (cmd.isAsync) {
                    this.requestActionAsync(cmd.action, ...cmd.values);
                } else {
                    this.target._handleNativeCall(cmd.action, ...cmd.values);
                }
            }
        }
    }

    isReady() {
        return !!this.target;
    }

    pleaseRepaint() {
        if (window.displayWatcher) {
            return window.displayWatcher.pleaseRepaint();
        }
    }

    _onInitialized() {
        if (window.displayWatcher) {
            window.displayWatcher.setInitialised(true);
        }
    }

    _dispatchEvent(eventName, eventParameter) {
        if (window.displayWatcher) {
            window.displayWatcher.dispatchEvent(eventName, eventParameter || {});
        }
    }
}

function initNativeHandlerIfAvailable() {
    if (window.QWebChannel) {
        // Means we're running inside OpenLP
        new window.QWebChannel(window.qt.webChannelTransport, (channel) => {
            window.displayWatcher = channel.objects.displayWatcher;

            // Defining window title as exposed by OpenLP
            (window.displayWatcher.getWindowTitle || (() => Promise.resolve('')))()
                .then((windowTitle) => {
                    if (windowTitle) {
                        const titleTag = document.head.getElementsByTagName('title')[0];
                        if (titleTag) {
                            titleTag.innerText = `${titleTag.innerText} (${windowTitle})`;
                        }
                    }
                });

        });
    }
}

// Instantiate immediately so requestAction is available as soon as scripts load
var communicationBridge = new CommunicationBridge();
window.communicationBridge = communicationBridge;
window.requestAction = communicationBridge.requestAction.bind(communicationBridge);
window.requestActionAsync = communicationBridge.requestActionAsync.bind(communicationBridge);
window.isReady = communicationBridge.isReady.bind(communicationBridge);

window.initCommunicationBridge = () => {
    initNativeHandlerIfAvailable();
};