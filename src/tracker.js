/**
 * --------------------------------------------------------------------------
 * Frontend Tracker (v0.0.1): tracker.js
 * Licensed under GPL-3.0
 * --------------------------------------------------------------------------
 */
window.setTracker = function (config) {
  'use strict';
  (function (config) {
    /**
     * ------------------------------------------------------------------------
     * Modify XMLHttpRequest
     * ------------------------------------------------------------------------
     */
    var RealXMLHttpRequest = window.XMLHttpRequest
    window.XMLHttpRequest.prototype.tracker = {
      _time_init: 0,
      _time_open: 0,
      _time_send: 0,
      _time_load: 0,
      _time_done: 0,
      _request_method: '',
      _request_url: '',
      _response_data: '',
      _status: ''
    }
    window.XMLHttpRequest = function () {
      var returnXHR = new RealXMLHttpRequest()
      returnXHR._tracker_open = returnXHR.open
      returnXHR.addEventListener('error', xhrEventHandler)
      returnXHR.addEventListener('timeout', xhrEventHandler)
      returnXHR.addEventListener('readystatechange', xhrEventHandler)
      returnXHR.open = function (method, url, async, user, password) {
        returnXHR.tracker._request_method = method
        returnXHR.tracker._request_url = url
        returnXHR.tracker._time_open = utilities.getTime()
        return returnXHR._tracker_open(method, url, async, user, password)
      }
      return returnXHR
    }

    /**
     * ------------------------------------------------------------------------
     * Utilities
     * ------------------------------------------------------------------------
     */
    var utilities = {
      getTime: function () {
        return new Date().getTime()
      },
      getUserAgent: function () {
        return window.navigator.userAgent
      },
      getCurrentURL: function () {
        return window.location.href
      },
      checkCrossOrigin: function (data, config) {
        if (data && config) {
          var noCrossFlag = false
          for (var index = 0; index < config.length; index++) {
            if (data.match(config[index])) {
              noCrossFlag |= true
            }
          }
          return !noCrossFlag
        } else {
          return false
        }
      },
      checkTimingSlow: function (data, config) {
        if (config) {
          return (data.send > config.sned && config.sned > 0) || (data.load > config.load && config.load > 0) || (data.total > config.total && config.total > 0)
        }
        return false
      },
      calculateTrackerTiming: function (tracker) {
        if (tracker._time_done && tracker._time_load && tracker._time_send && tracker._time_done) {
          var send = tracker._time_send - tracker._time_open
          var load = tracker._time_load - tracker._time_send
          var total = tracker._time_done - tracker._time_open
          return {send: send, load: load, total: total}
        } else {
          return {send: 0, load: 0, total: 0}
        }
      },
      composeTrackerData: function (type, data) {
        return {type: type, data: data}
      },
      composeScriptErrorData: function (message, file, line, column, trace) {
        trace = trace && trace.stack ? trace.stack.toString() : ''
        return {message: message, detail: {file: file, line: line, column: column, trace: trace}}
      },
      composeXHRErrorData: function (message, request, response, timing) {
        return {message: message, detail: {request: request, response: response, timing: timing}}
      },
      composeResourceErrorData: function (message, tagName, resourceURL) {
        return {message: message, detail: {tagname: tagName, resourceURL: resourceURL}}
      }
    }

    /**
     * ------------------------------------------------------------------------
     * Error handlers
     * ------------------------------------------------------------------------
     */
    function scriptErrorHandler (ev) {
      if (!ev.message) {
        return true
      }
      var errorData = utilities.composeScriptErrorData(ev.message, ev.filename, ev.lineno, ev.colno, ev.error)
      if (!utilities.checkCrossOrigin(ev.filename, config.script.exclude || !config.script)) {
        uploadError('SCRIPT', errorData)
      }
    }

    function resourceLoadingHandler (ev) {
      var tag = ev.target.tagName
      var resource = ev.target.src
      if (!utilities.checkCrossOrigin(resource, config.resource.exclude || !config.resource)) {
        return true
      }
      if (ev.type === 'load') {
        if (config.resource.log.crossOrigin && utilities.checkCrossOrigin(resource, config.resource.origin)) {
          var errorData = utilities.composeResourceErrorData('CROSS ORIGIN', tag, resource)
          uploadError('RESOURCE', errorData)
        }
      } else if (ev.type === 'error') {
        if (config.resource.log.error) {
          errorData = utilities.composeResourceErrorData('LOAD ERROR', tag, resource)
          uploadError('RESOURCE', errorData)
        }
      }
    }

    function xhrEventHandler (ev) {
      var xhrObject = ev.target
      if (!utilities.checkCrossOrigin(xhrObject.tracker._request_url, config.xhr.exclude) || !config.xhr) {
        return true
      }
      if (ev.type === 'readystatechange') {
        var varibleSequence = [
          '_time_init',
          '_time_open',
          '_time_send',
          '_time_load',
          '_time_done'
        ];
        (varibleSequence[xhrObject.readyState]) && (xhrObject.tracker[varibleSequence[xhrObject.readyState]] = utilities.getTime())
        if (xhrObject.readyState === 4) {
          xhrObject.tracker._response_data = xhrObject.responseText
          xhrObject.tracker._status = xhrObject.status
          var xhrTiming = utilities.calculateTrackerTiming(xhrObject.tracker)
          if (config.xhr.log.crossOrigin && utilities.checkCrossOrigin(xhrObject.tracker._request_url, config.xhr.origin)) {
            var errorData = utilities.composeXHRErrorData('CORSS ORIGIN', xhrObject.tracker._request_url, {status: xhrObject.tracker._status, response: xhrObject.tracker._response_data}, xhrTiming)
            uploadError('XHR', errorData)
          }
          if (config.xhr.log.slowRequest && utilities.checkTimingSlow(xhrTiming, config.xhr.timeLimit)) {
            errorData = utilities.composeXHRErrorData('SLOW REQUEST', xhrObject.tracker._request_url, {status: xhrObject.tracker._status, response: xhrObject.tracker._response_data}, xhrTiming)
            uploadError('XHR', errorData)
          }
        }
      } else if (ev.type === 'error') {
        xhrObject.tracker._response_data = xhrObject.responseText
        xhrObject.tracker._status = xhrObject.status
        if (config.xhr.log.error) {
          errorData = utilities.composeXHRErrorData('ERROR', xhrObject.tracker._request_url, {status: xhrObject.tracker._status, response: xhrObject.tracker._response_data}, xhrTiming)
          uploadError('XHR', errorData)
        }
      } else if (ev.type === 'timeout') {
        xhrObject.tracker._response_data = xhrObject.responseText
        xhrObject.tracker._status = xhrObject.status
        if (config.xhr.log.timeout) {
          errorData = utilities.composeXHRErrorData('TIMEOUT', xhrObject.tracker._request_url, {status: xhrObject.tracker._status, response: xhrObject.tracker._response_data}, xhrTiming)
          uploadError('XHR', errorData)
        }
      }
    }

    /**
     * ------------------------------------------------------------------------
     * Send data
     * ------------------------------------------------------------------------
     */
    function uploadError (type, data) {
      var composedData = utilities.composeTrackerData(type, data)
      composedData.currentURL = utilities.getCurrentURL()
      composedData.userAgent = utilities.getUserAgent()
      window.setTimeout(function () {
        sendData(composedData)
      }, 0)
    }

    function sendData (data) {
      var dataString = JSON.stringify(data)
      var xhr = new window.XMLHttpRequest()
      xhr.open('POST', config.endpoint, true)
      xhr.send(dataString)
    }

    /**
     * ------------------------------------------------------------------------
     * Listening events
     * ------------------------------------------------------------------------
     */
    window.addEventListener('error', scriptErrorHandler, true)
    document.addEventListener('error', resourceLoadingHandler, true)
    document.addEventListener('load', resourceLoadingHandler, true)
  })(config)
}
