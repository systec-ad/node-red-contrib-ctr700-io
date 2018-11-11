/****************************************************************************

  (c) SYSTEC electronic GmbH, D-08468 Heinsdorfergrund, Am Windrad 2
      www.systec-electronic.com

  Project:      SYSTEC sysWORXX CTR-700
  Description:  JS bindings for board driver

  -------------------------------------------------------------------------

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

  -------------------------------------------------------------------------

  Revision History:

  2017/10/23 -ad:   V1.00 Initial version

****************************************************************************/

ref = require ('ref');
ffi = require ('ffi');
StructMeta = require ('ref-struct');
ArrayMeta  = require ('ref-array');


t = ref.types;


tCtr700DrvHwInfo = StructMeta({
    m_bPcbRevision:     t.uint8,
    m_uDiChannels:      t.uint16,
    m_uDoChannels:      t.uint16,
    m_uRelayChannels:   t.uint16,
    m_uAiChannels:      t.uint16,
    m_uAoChannels:      t.uint16,
    m_uCntChannels:     t.uint16,
    m_uEncChannels:     t.uint16,
    m_uPwmChannels:     t.uint16,
    m_uTmpChannels:     t.uint16
});
tCtr700DrvHwInfoPtr = ref.refType(tCtr700DrvHwInfo);


tCtr700DrvDiagInfo = StructMeta({
    m_fDigiOutPowerFail:t.uint8,
    m_fDigiOutDiag:     t.uint8,
    m_fDigiInError:     t.uint8,
    m_fUsbOverCurrent:  t.uint8,
});
tCtr700DrvDiagInfoPtr = ref.refType(tCtr700DrvDiagInfo);


uint8_ptr  = ref.refType(t.uint8);
uint16_ptr = ref.refType(t.uint16);
uint32_ptr = ref.refType(t.uint32);

tInterruptCallback = 'pointer';

LibCtr700Drv = ffi.Library(
    'libctr700drv',
    {
        'Ctr700DrvGetVersion':      [t.int32, [uint8_ptr, uint8_ptr]],
        'Ctr700DrvInitialize':      [t.int32, []],
        'Ctr700DrvShutDown':        [t.int32, []],
        'Ctr700DrvGetTickCount':    [t.int32, [uint32_ptr]],
        'Ctr700DrvEnableWatchdog':  [t.int32, [t.uint8]],
        'Ctr700DrvServiceWatchdog': [t.int32, []],
        'Ctr700DrvGetHardwareInfo': [t.int32, [tCtr700DrvHwInfoPtr]],

        'Ctr700DrvSetRunLed':       [t.int32, [t.uint8]],
        'Ctr700DrvSetErrLed':       [t.int32, [t.uint8]],
        'Ctr700DrvGetRunSwitch':    [t.int32, [uint8_ptr]],
        'Ctr700DrvGetConfigEnabled':[t.int32, [uint8_ptr]],
        'Ctr700DrvGetPowerFail':    [t.int32, [uint8_ptr]],
        'Ctr700DrvGetDiagInfo':     [t.int32, [tCtr700DrvDiagInfoPtr]],

        'Ctr700DrvGetExtFail':      [t.int32, [uint8_ptr]],
        'Ctr700DrvSetExtReset':     [t.int32, [t.uint8]],

        'Ctr700DrvGetDigiIn':       [t.int32, [t.uint8, uint8_ptr]],
        'Ctr700DrvSetDigiOut':      [t.int32, [t.uint8, t.uint8]],
        'Ctr700DrvSetRelay':        [t.int32, [t.uint8, t.uint8]],
        'Ctr700DrvAdcGetValue':     [t.int32, [t.uint8, uint16_ptr]],
        'Ctr700DrvAdcSetMode':      [t.int32, [t.uint8, t.uint8]],
        'Ctr700DrvTmpGetValue':     [t.int32, [t.uint8, uint32_ptr]],

        'Ctr700DrvPwmSetTimeBase':  [t.int32, [t.uint8, t.uint8]],
        'Ctr700DrvPwmSetParam':     [t.int32, [t.uint8, t.uint32, t.uint32]],
        'Ctr700DrvPwmEnable':       [t.int32, [t.uint8, t.uint8]],

        'Ctr700DrvRegisterInterruptCallback':   [t.int32, [t.uint8, tInterruptCallback, t.uint32]],
        'Ctr700DrvUnregisterInterruptCallback': [t.int32, [t.uint8]],
    }
);


const ErrorMessages = {
    0xff: "Generic error",
    0xfe: "Not implemented",
    0xfd: "Invalid parameter",
    0xfc: "Invalid channel",
    0xfb: "Invalid mode",
    0xfa: "Invalid timebase",
    0xf9: "Invalid delta",
    0xf8: "PTO tab is full",
    0xf7: "Access to device failed",
    0xf6: "Process image configuration invalid",
    0xf5: "Process image configuration unknown",
    0xf4: "Shared process image error",
    0xf3: "Address out of range",
    0xf2: "Watchdog timeout"
};

class Ctr700DrvException extends Error {
    constructor (errorCode) {
        super()
        Error.captureStackTrace(this, this.constructor);

        this.code = errorCode;
        this.message = ErrorMessages[errorCode] || "Unknown error code :" + errorCode;
    }
}


class Ctr700Drv {

    // Singleton constructor
    constructor () {

        if (typeof Ctr700Drv.instanceCount === 'undefined') {
            Ctr700Drv.instanceCount = 0;
        }

        if (!Ctr700Drv.instance) {
            this._callbacks = {};
            Ctr700Drv.instance = this;
        }

        return Ctr700Drv.instance;
    }

    getVersion() {
        const versionMajor = ref.alloc('uint8');
        const versionMinor = ref.alloc('uint8');

        const result = LibCtr700Drv.Ctr700DrvGetVersion(versionMajor, versionMinor);
        this._checkErrorCode(result);

        return { major: versionMajor.deref(), minor: versionMinor.deref(), }
    }

    init () {
        if (Ctr700Drv.instanceCount == 0) {
            const result = LibCtr700Drv.Ctr700DrvInitialize();
            this._checkErrorCode(result);
        }

        Ctr700Drv.instanceCount++;
    }

    shutDown () {
        Ctr700Drv.instanceCount--;

        if (Ctr700Drv.instanceCount == 0) {
            const result = LibCtr700Drv.Ctr700DrvShutDown();
            this._checkErrorCode(result);
        }

        if (Ctr700Drv.instanceCount < 0) {
            throw new Error("Ctr700Drv is not initialized!");
        }
    }

    getHwInfo() {
        const HwInfo = new tCtr700DrvHwInfo();
        const result = LibCtr700Drv.Ctr700DrvGetHardwareInfo(HwInfo.ref());
        this._checkErrorCode(result);

        return {
            'PcbRevision':  HwInfo.m_bPcbRevision,
            'DiChannels':   HwInfo.m_uDiChannels,
            'DoChannels':   HwInfo.m_uDoChannels,
            'RelayChannels':HwInfo.m_uRelayChannels,
            'AiChannels':   HwInfo.m_uAiChannels,
            'AoChannels':   HwInfo.m_uAoChannels,
            'CntChannels':  HwInfo.m_uCntChannels,
            'CntChannels':  HwInfo.m_uEncChannels,
            'PwmChannels':  HwInfo.m_uPwmChannels,
            'TmpChannels':  HwInfo.m_uTmpChannels
        }
    }

    getTickCount () {
        const tickCount = ref.alloc('uint32');
        const result = LibCtr700Drv.Ctr700DrvGetTickCount(tickCount);
        this._checkErrorCode(result);
        return tickCount.deref();
    }

    enableWatchdog(monitorOnly) {
        const result = LibCtr700Drv.Ctr700DrvEnableWatchdog(monitorOnly);
        this._checkErrorCode(result);
    }

    serviceWatchdog() {
        const result = LibCtr700Drv.Ctr700DrvServiceWatchdog();
        this._checkErrorCode(result);
    }

    getDigitalInput(channel) {
        const value = ref.alloc('uint8');

        const result = LibCtr700Drv.Ctr700DrvGetDigiIn(channel, value);
        this._checkErrorCode(result);

        return value.deref();
    }

    setDigitalOutput (channel, value) {
        const ctrValue = value ? 1 : 0;
        const result = LibCtr700Drv.Ctr700DrvSetDigiOut(channel, ctrValue);
        this._checkErrorCode(result);
    }

    setRelay(channel, value) {
        const result = LibCtr700Drv.Ctr700DrvSetRelay(channel, value);
        this._checkErrorCode(result);
    }

    getAnalogInput(channel) {
        const value  = ref.alloc('uint16');
        const result = LibCtr700Drv.Ctr700DrvAdcGetValue(channel, value);
        this._checkErrorCode(result);
        return value.deref();
    }

    setupAnalogVoltage(channel) {
        const result = LibCtr700Drv.Ctr700DrvAdcSetMode(channel, 0);
        this._checkErrorCode(result);
    }

    setupAnalogCurrent(channel) {
        const result = LibCtr700Drv.Ctr700DrvAdcSetMode(channel, 1);
        this._checkErrorCode(result);
    }

    getAnalogInputs() {
        const values = new Array();

        for (let i = 0; i < 4; i++) {
            values.push(this.getAnalogInput(i));
        }

        return values;
    }

    getTemperature(channel) {
        const temperature = ref.alloc('uint32');

        const result = LibCtr700Drv.Ctr700DrvTmpGetValue(channel, temperature);
        this._checkErrorCode(result);

        return temperature.deref();
    }

    setRunLed(enable) {
        let result;

        if (enable) {
            result = LibCtr700Drv.Ctr700DrvSetRunLed(1);
        } else {
            result = LibCtr700Drv.Ctr700DrvSetRunLed(0);
        }

        this._checkErrorCode(result);
    }

    setErrorLed(enable) {
        let result;

        if (enable) {
            result = LibCtr700Drv.Ctr700DrvSetErrLed(1);
        } else {
            result = LibCtr700Drv.Ctr700DrvSetErrLed(0);
        }

        this._checkErrorCode(result);
    }

    getRunSwitch() {
        let value = ref.alloc('uint8');
        const result = LibCtr700Drv.Ctr700DrvGetRunSwitch(value);
        this._checkErrorCode(result);

        if (value.deref() == 1) {
            return true;
        } else {
            return false;
        }
    }

    getConfigMode() {
        let value = ref.alloc('uint8');
        const result = LibCtr700Drv.Ctr700DrvGetConfigEnabled(value);
        this._checkErrorCode(result);

        if (value.deref() == 1) {
            return true;
        } else {
            return false;
        }
    }

    getPowerFail() {
        let value = ref.alloc('uint8');
        const result = LibCtr700Drv.Ctr700DrvGetPowerFail(value);
        this._checkErrorCode(result);

        if (value.deref() == 1) {
            return true;
        } else {
            return false;
        }
    }

    getDiagInfo() {
        let diagInfo = new tCtr700DrvDiagInfo();
        const result = LibCtr700Drv.Ctr700DrvGetDiagInfo(diagInfo.ref());
        this._checkErrorCode(result);

        const diagInfoObj = {
            'DO_PowerFail': diagInfo.m_fDigiOutPowerFail,
            'DO_Diag': diagInfo.m_fDigiOutDiag,
            'DI_Error': diagInfo.m_fDigiInError,
            'USB_OverCurrent': diagInfo.m_fUsbOverCurrent,
        };
        return diagInfoObj;
    }

    getExtFail() {
        let value = ref.alloc('uint8');
        const result = LibCtr700Drv.Ctr700DrvGetExtFail(value);
        this._checkErrorCode(result);

        if (value.deref() == 1) {
            return true;
        } else {
            return false;
        }
    }

    setExtReset(value) {
        const result = LibCtr700Drv.Ctr700DrvSetExtReset(value);
        this._checkErrorCode(result);
    }

    enablePwm(channel, period, duty) {
        let result = LibCtr700Drv.Ctr700DrvPwmSetTimeBase(channel, 2);
        this._checkErrorCode(result);

        result = LibCtr700Drv.Ctr700DrvPwmSetParam(channel, period, duty);
        this._checkErrorCode(result);

        result = LibCtr700Drv.Ctr700DrvPwmEnable(channel, 1);
        this._checkErrorCode(result);
    }

    disablePwm(channel) {
        const result = LibCtr700Drv.Ctr700DrvPwmEnable(channel, 0);
        this._checkErrorCode(result);
    }

    registerInterrupt(channel, rising_edge, falling_edge, callback) {
        let callback_ref = ffi.Callback(t.void, [t.uint8, t.uint8], callback);
        let trigger = 0;

        if (rising_edge) {
            trigger |= 0x01;
        }

        if (falling_edge) {
            trigger |= 0x02;
        }

        const result = LibCtr700Drv.Ctr700DrvRegisterInterruptCallback(channel, callback_ref, trigger);
        this._checkErrorCode(result);

        // save a reference to the callback to ensure it does not get
        // garbage-collected
        this._callbacks[channel] = callback_ref
    }

    unregisterInterrupt(channel) {
        const result = LibCtr700Drv.Ctr700DrvUnregisterInterruptCallback(channel);
        this._checkErrorCode(result);
        delete this._callbacks[channel]
    }

    _checkErrorCode (errorCode) {
        if (errorCode != 0) {
            throw new Ctr700DrvException(errorCode)
        }
    }
}

exports.Ctr700Drv = Ctr700Drv;
