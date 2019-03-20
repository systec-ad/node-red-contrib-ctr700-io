/****************************************************************************

  (c) SYSTEC electronic GmbH, D-08468 Heinsdorfergrund, Am Windrad 2
      www.systec-electronic.com

  Project:      Node-RED Node 'ctr700 ai'
  Description:  Node implementation

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

  2018/02/25 -rs:   V1.00 Initial version
  2019/03/20 -ad:   V1.01 Fix handling for initial value

****************************************************************************/


module.exports = function(RED)
{

    //*********************************************************************//
    //                                                                     //
    //                  G L O B A L S                                      //
    //                                                                     //
    //*********************************************************************//

    "use strict";


    //=======================================================================
    //  Import external modules
    //=======================================================================

    const ctr700drv = require('./ctr700drv.js');



    //=======================================================================
    //  Runtime Configuration
    //=======================================================================

    // Disable runtime warning: "Possible EventEmitter memory leak detected. 11 nodes-started listeners added. Use  emitter.setMaxListeners() to increase limit"
    require('events').EventEmitter.defaultMaxListeners = 0;

    const DEF_NEW_DATA_STATUS_PERIOD = 1000;        // Show new data status period for [ms]

    const TRACE_ENABLE_ALL           = false;       // Enables traces for all nodes
    const TRACE_ENABLE_NODE_NAME_DBG = true;        // Enables traces only for nodes which node names starts with 'DBG_'



    //=======================================================================
    //  Constant definitions
    //=======================================================================

    const ADC_STATE_ACTIVE   =  1;
    const ADC_STATE_IDLE     =  0;
    const ADC_STATE_ERROR    = -1;
    const ADC_STATE_UNDEF    = -2;



    //=======================================================================
    //  Register node to Node-RED nodes palette
    //=======================================================================

    RED.nodes.registerType ("ctr700_ai", Ctr700_AI_Node);



    //=======================================================================
    //  Node implementation
    //=======================================================================

    function  Ctr700_AI_Node (NodeConfig_p)
    {

        //-------------------------------------------------------------------
        //  Node main function
        //-------------------------------------------------------------------

        let ThisNode = this;

        // create new node instance
        RED.nodes.createNode (this, NodeConfig_p);

        // register handler for event type 'input'
        ThisNode.on ('input', Ctr700_AI_NodeHandler_OnInput);

        // register handler for event type 'close'
        ThisNode.on ('close', Ctr700_AI_NodeHandler_OnClose);

        // register one-time handler for sending the initial value
        ThisNode.m_injectImmediate = setImmediate(function()
        {
            Ctr700_AI_NodeHandler_OnNodesStarted();
        });

        // run handler for event type 'open'
        Ctr700_AI_NodeHandler_OnOpen (NodeConfig_p);

        return;



        //-------------------------------------------------------------------
        //  Node event handler [NODE / OPEN]
        //-------------------------------------------------------------------

        function  Ctr700_AI_NodeHandler_OnOpen (NodeConfig_p)
        {

            var strName;
            var strChannel;
            var strMode;
            var strSampleRate;
            var strSampleUnit;
            var strDelta;
            var fUnit1000;
            var strUpperValType;
            var strUpperValData;
            var strLowerValType;
            var strLowerValData;
            var strDecPlaces;
            var fAltTopic;
            var strAltTopic;

            ThisNode.m_NodeConfig = NodeConfig_p;
            TraceMsg ('{Ctr700_AI_Node} creating...');

            // create and initialize members
            ThisNode.m_iChannelNumber = -1;
            ThisNode.m_strMode = "";
            ThisNode.m_iSampleRate = -1;
            ThisNode.m_iDelta = -1;
            ThisNode.m_fUnit1000 = false;
            ThisNode.m_strUpperValType = "";
            ThisNode.m_flUpperValData = 0.0;
            ThisNode.m_strLowerValType = "";
            ThisNode.m_flLowerValData = 0.0;
            ThisNode.m_iDecPlaces = -1;
            ThisNode.m_flDigitValue = 0.0;
            ThisNode.m_strTopic = "";
            ThisNode.m_strName = "";
            ThisNode.m_fNodeCfgValid = true;
            ThisNode.m_iLastAdcValue = -32768;
            ThisNode.m_iDeltaProcVal = -1;
            ThisNode.m_objSampleTimerID = -1;
            ThisNode.m_iLastAdcDataState = ADC_STATE_UNDEF;
            ThisNode.m_iNewDataStatusPeriod = DEF_NEW_DATA_STATUS_PERIOD;
            ThisNode.m_ObjStatusTimer = null;
            ThisNode.m_iStatusTimerInst = 0;

            // create I/O driver instance
            TraceMsg ('{Ctr700_AI_Node} new ctr700drv.Ctr700Drv');
            ThisNode.m_ObjCtr700Drv = new ctr700drv.Ctr700Drv;

            // initialize I/O driver instance
            TraceMsg ('{Ctr700_AI_Node} ObjCtr700Drv.init()');
            ThisNode.m_ObjCtr700Drv.init();

            // get node configuration
            strChannel      = ThisNode.m_NodeConfig.channel;
            strMode         = ThisNode.m_NodeConfig.mode;
            strSampleRate   = ThisNode.m_NodeConfig.samplerate;
            strSampleUnit   = ThisNode.m_NodeConfig.sampleunit;
            strDelta        = ThisNode.m_NodeConfig.delta;
            fUnit1000       = ThisNode.m_NodeConfig.optunit1000;
            strUpperValType = ThisNode.m_NodeConfig.uppervaltype;
            strUpperValData = ThisNode.m_NodeConfig.uppervaldata;
            strLowerValType = ThisNode.m_NodeConfig.lowervaltype;
            strLowerValData = ThisNode.m_NodeConfig.lowervaldata;
            strDecPlaces    = ThisNode.m_NodeConfig.decplaces;
            fAltTopic       = ThisNode.m_NodeConfig.optalttopic;
            strAltTopic     = ThisNode.m_NodeConfig.alttopic;
            strName         = ThisNode.m_NodeConfig.name;

            TraceMsg ('{Ctr700_AI_Node} strChannel:      ' + strChannel);
            TraceMsg ('{Ctr700_AI_Node} strMode:         ' + strMode);
            TraceMsg ('{Ctr700_AI_Node} strSampleRate    ' + strSampleRate);
            TraceMsg ('{Ctr700_AI_Node} strSampleUnit:   ' + strSampleUnit);
            TraceMsg ('{Ctr700_AI_Node} strDelta:        ' + strDelta);
            TraceMsg ('{Ctr700_AI_Node} fUnit1000:       ' + fUnit1000);
            TraceMsg ('{Ctr700_AI_Node} strUpperValType  ' + strUpperValType);
            TraceMsg ('{Ctr700_AI_Node} strUpperValData: ' + strUpperValData);
            TraceMsg ('{Ctr700_AI_Node} strLowerValType  ' + strLowerValType);
            TraceMsg ('{Ctr700_AI_Node} strLowerValData: ' + strLowerValData);
            TraceMsg ('{Ctr700_AI_Node} strDecPlaces:    ' + strDecPlaces);
            TraceMsg ('{Ctr700_AI_Node} fAltTopic:       ' + fAltTopic);
            TraceMsg ('{Ctr700_AI_Node} strAltTopic:     ' + strAltTopic);
            TraceMsg ('{Ctr700_AI_Node} strName:         ' + strName);

            // get input channel number
            ThisNode.m_iChannelNumber = Ctr700_AI_GetInputChannelNumber (strChannel);
            TraceMsg ('{Ctr700_AI_Node} m_iChannelNumber: ' + ThisNode.m_iChannelNumber);

            // get analog channel mode
            ThisNode.m_strMode = strMode;

            // get analog channel sample rate
            ThisNode.m_iSampleRate = Ctr700_AI_GetInputSampleRate (strSampleRate, strSampleUnit);
            TraceMsg ('{Ctr700_AI_Node} m_iSampleRate: ' + ThisNode.m_iSampleRate + '[ms]');
            if (ThisNode.m_iSampleRate <= 0)
            {
                TraceMsg ('{Ctr700_AI_Node} ERROR: NodeConfig is invalid (m_iSampleRate <= 0)');
                ThisNode.m_fNodeCfgValid = false;
            }

            // get payload specification
            ThisNode.m_iDelta          = parseInt(strDelta, 10);
            ThisNode.m_fUnit1000       = fUnit1000;
            ThisNode.m_strUpperValType = strUpperValType;
            ThisNode.m_flUpperValData  = parseFloat(strUpperValData);
            ThisNode.m_strLowerValType = strLowerValType;
            ThisNode.m_flLowerValData  = parseFloat(strLowerValData);
            ThisNode.m_iDecPlaces      = Ctr700_AI_GetNumOfDecPlaces(strDecPlaces);

            TraceMsg ('{Ctr700_AI_Node} strDelta        -> m_iDelta:         ' + ThisNode.m_iDelta);
            TraceMsg ('{Ctr700_AI_Node} strUpperValData -> m_flUpperValData: ' + ThisNode.m_flUpperValData);
            TraceMsg ('{Ctr700_AI_Node} strLowerValData -> m_flLowerValData: ' + ThisNode.m_flLowerValData);
            TraceMsg ('{Ctr700_AI_Node} strDecPlaces    -> m_iDecPlaces:     ' + ThisNode.m_iDecPlaces);

            if ( isNaN(ThisNode.m_iDelta) || isNaN(ThisNode.m_flUpperValData) || isNaN(ThisNode.m_flLowerValData) )
            {
                TraceMsg ('{Ctr700_AI_Node} ERROR: NodeConfig is invalid (m_fNodeCfgValid = false)');
                ThisNode.m_fNodeCfgValid = false;
            }

            // convert user configured 'delta' value into ADC data format (12bit ADC -> SHL(3) -> 15bit ADC)
            ThisNode.m_iDeltaProcVal = ThisNode.m_iDelta * 8;
            TraceMsg ('{Ctr700_AI_Node} SHL(m_iDelta,3) -> m_iDeltaProcVal   ' + ThisNode.m_iDeltaProcVal);

            if ( ThisNode.m_fNodeCfgValid )
            {
                ThisNode.m_flDigitValue = Ctr700_AI_GetDigitValue (ThisNode.m_flUpperValData, ThisNode.m_flLowerValData);
                TraceMsg ('{Ctr700_AI_Node} U/L ValData     -> m_flDigitValue:   ' + ThisNode.m_flDigitValue);
            }

            // get topic for publishing input channel state messages
            ThisNode.m_strTopic = Ctr700_AI_BuildTopicString (ThisNode.m_iChannelNumber, fAltTopic, strAltTopic);
            TraceMsg ('{Ctr700_AI_Node} m_strTopic: ' + ThisNode.m_strTopic);

            // get node name
            ThisNode.m_strName = strName;

            // set ADC input mode (voltage or current)
            TraceMsg ('{Ctr700_AI_Node} Set ADC input mode (Channel: ' + ThisNode.m_iChannelNumber + ', Mode: ' + strMode);
            Ctr700_AI_SetAdcInputMode (ThisNode.m_iChannelNumber, strMode);

            // check for successful configuration, show configuration error otherwise
            if ( !ThisNode.m_fNodeCfgValid )
            {
                Ctr700_AI_ShowAdcDataState (ADC_STATE_ERROR);
            }

            // publishing initial input channel state is done in callback function 'Ctr700_AI_NodeHandler_OnNodesStarted()'

            return;

        }



        //-------------------------------------------------------------------
        //  Node event handler [NODE / CLOSE]
        //-------------------------------------------------------------------

        function  Ctr700_AI_NodeHandler_OnClose ()
        {

            TraceMsg ('{Ctr700_AI_Node} closing...');

            // clear immediate timeout
            if (ThisNode.m_injectImmediate)
            {
                clearImmediate(ThisNode.m_injectImmediate);
            }

            // clear interval timer for cyclic data processing
            if (ThisNode.m_objSampleTimerID != -1)
            {
                TraceMsg ('{Ctr700_AI_Node} clearInterval (' + ThisNode.m_objSampleTimerID + ')');
                clearInterval (ThisNode.m_objSampleTimerID);
                ThisNode.m_objSampleTimerID = -1;
            }

            // shutdown driver instance
            TraceMsg ('{Ctr700_AI_Node} ObjCtr700Drv.shutDown()');
            ThisNode.m_ObjCtr700Drv.shutDown();

            // cleares the status entry from the node
            Ctr700_AI_ShowAdcDataState (ADC_STATE_UNDEF);

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [NODE / EVENT_INPUT]
        //-------------------------------------------------------------------

        function  Ctr700_AI_NodeHandler_OnInput (Msg_p)
        {

            TraceMsg ('{Ctr700_AI_Node} procesing input message...');

            // This node is an input node and therefore it does not process any messages

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [EVENTS / NODE_STARTED]
        //-------------------------------------------------------------------

        function  Ctr700_AI_NodeHandler_OnNodesStarted ()
        {

            var fChannelValue;

            TraceMsg ('{Ctr700_AI_Node} process initial input state...');

            // publish initial input channel state
            Ctr700_AI_PublishInputChannelState (ThisNode.m_iChannelNumber);

            // start interval timer for cyclic data processing
            TraceMsg ('{Ctr700_AI_Node} setInterval (' + ThisNode.m_iSampleRate + ')');
            ThisNode.m_objSampleTimerID = setInterval (Ctr700_AI_CbTimerProcAdcData, ThisNode.m_iSampleRate);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Callback handler for cyclic data processing
        //-------------------------------------------------------------------

        function  Ctr700_AI_CbTimerProcAdcData ()
        {

            TraceMsg ('{Ctr700_AI_Node} Ctr700_AI_CbTimerProcAdcData...');

            // publish current input channel state
            Ctr700_AI_PublishInputChannelState (ThisNode.m_iChannelNumber);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Set ADC input mode (voltage or current)
        //-------------------------------------------------------------------

        function  Ctr700_AI_SetAdcInputMode (iChannelNumber_p, strMode_p)
        {

            TraceMsg ('{Ctr700_AI_Node} Ctr700_AI_SetAdcInputMode: iChannelNumber_p=' + iChannelNumber_p + ', strMode_p=' + strMode_p);

            switch (strMode_p)
            {
                case "MODE_VOLTAGE":
                case "MODE_VOLTAGE_USER":
                {
                    TraceMsg ('{Ctr700_AI_Node} ObjCtr700Drv.setupAnalogVoltage(' + iChannelNumber_p + ')');
                    ThisNode.m_ObjCtr700Drv.setupAnalogVoltage(iChannelNumber_p);
                    break;
                }

                case "MODE_CURRENT":
                case "MODE_CURRENT_USER":
                {
                    TraceMsg ('{Ctr700_AI_Node} ObjCtr700Drv.setupAnalogCurrent(' + iChannelNumber_p + ')');
                    ThisNode.m_ObjCtr700Drv.setupAnalogCurrent(iChannelNumber_p);
                    break;
                }

                default:
                {
                    TraceMsg ('{Ctr700_AI_Node} ERROR: ChannelMode is invalid (strMode_p=' + strMode_p + ')');
                    break;
                }
            }

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Publish input channel state
        //-------------------------------------------------------------------

        function  Ctr700_AI_PublishInputChannelState (iChannelNumber_p)
        {

            var iChannelNumber;
            var iAdcValue;
            var iAdcDelta;
            var vProcValue;
            var strProcValueFix;
            var vProcData;
            var Msg = { topic: "", payload: 0 };

            TraceMsg ('{Ctr700_AI_Node} Ctr700_AI_PublishInputChannelState: iChannelNumber_p=' + iChannelNumber_p);

            // read ADC value
            iAdcValue = ThisNode.m_ObjCtr700Drv.getAnalogInput(iChannelNumber_p);
            TraceMsg ('{Ctr700_AI_Node} ObjCtr700Drv.getAnalogInput(' + iChannelNumber_p + ') -> iAdcValue=' + iAdcValue);

            iAdcDelta = Math.abs(iAdcValue - ThisNode.m_iLastAdcValue);
            TraceMsg ('{Ctr700_AI_Node} iAdcValue=' + iAdcValue);
            TraceMsg ('{Ctr700_AI_Node} iLastAdcValue=' + ThisNode.m_iLastAdcValue + ' -> iAdcDelta=' + iAdcDelta);
            TraceMsg ('{Ctr700_AI_Node} ThisNode.m_iDelta=' + ThisNode.m_iDelta + ' -> ThisNode.m_iDeltaProcVal=' + ThisNode.m_iDeltaProcVal);
            if (iAdcDelta < ThisNode.m_iDeltaProcVal)
            {
                TraceMsg ('{Ctr700_AI_Node} Delta (' + ThisNode.m_iDeltaProcVal + ') not reached -> ignore value');
                return;
            }
            ThisNode.m_iLastAdcValue = iAdcValue;

            // calculate process value from field value
            vProcValue = (iAdcValue * ThisNode.m_flDigitValue) + ThisNode.m_flLowerValData;
            TraceMsg ('{Ctr700_AI_Node} vProcValue=' + vProcValue);

            // limit the number of decimal places the configured number
            if (ThisNode.m_iDecPlaces > -1)
            {
                try
                {
                    strProcValueFix = vProcValue.toFixed(ThisNode.m_iDecPlaces);        // num.toFixed() changes data type to string
                    vProcValue = strProcValueFix;
                }
                catch (ErrInfo)
                {
                    TraceMsg ('{Ctr700_AI_Node} ERROR: vProcValue.toFixed(' + ThisNode.m_iDecPlaces + ') failed!');
                    TraceMsg ('{Ctr700_AI_Node} ERROR: ' + ErrInfo.message);
                }
            }

            // build payload data for message to send
            vProcData = Ctr700_AI_BuildPayloadData (vProcValue, ThisNode.m_strUpperValType);

            // show IPC state in editor
            Ctr700_AI_ShowAdcDataState (ADC_STATE_ACTIVE);

            // send message
            Msg.topic   = ThisNode.m_strTopic;
            Msg.payload = vProcData;
            TraceMsg ('{Ctr700_AI_Node} SendMsg (topic=' + Msg.topic + ', payload=' + Msg.payload.toString() + ')');
            ThisNode.send (Msg);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Get input channel number
        //-------------------------------------------------------------------

        function  Ctr700_AI_GetInputChannelNumber (strChannelName_p)
        {

            var strChannelName;
            var strChannelNumber;
            var iChannelNumber;

            // check if channel name is valid
            if ((strChannelName_p == null) || (strChannelName_p.length == 0))
            {
                ThisNode.error ('{Ctr700_AI_Node} Invalid Output ChannelName (strChannelName_p is null or empty)');
                return (-1);
            }

            // normalize channel name
            strChannelName = strChannelName_p.trim();
            strChannelName = strChannelName.toUpperCase();

            // check for valid prefix
            if ( !strChannelName.startsWith('IN_AI') )
            {
                ThisNode.error ('{Ctr700_AI_Node} Invalid Output ChannelName: ' + strChannelName_p);
                return (-1);
            }

            // get channel number form channel name
            strChannelNumber = strChannelName.substr(5);
            iChannelNumber = parseInt(strChannelNumber);
            if (iChannelNumber === NaN)
            {
                ThisNode.error ('{Ctr700_AI_Node} Invalid Output Channelumber: ' + strChannelNumber);
                return (-1);
            }

            return (iChannelNumber);

        }



        //-------------------------------------------------------------------
        //  Private: Get input sample rate
        //-------------------------------------------------------------------

        function  Ctr700_AI_GetInputSampleRate (strSampleRate_p, strSampleUnit_p)
        {

            var iSampleRate;

            // check if sample rate is valid
            if ((strSampleRate_p == null) || (strSampleRate_p.length == 0))
            {
                ThisNode.error ('{Ctr700_AI_Node} Invalid Sample Rate (strSampleRate_p is null or empty)');
                return (-1);
            }

            // check if sample unit is valid
            if ((strSampleUnit_p == null) || (strSampleUnit_p.length == 0))
            {
                ThisNode.error ('{Ctr700_AI_Node} Invalid Sample Unit (strSampleUnit_p is null or empty)');
                return (-1);
            }

            iSampleRate = parseInt(strSampleRate_p, 10);
            if ( isNaN(iSampleRate) )
            {
                ThisNode.error ('{Ctr700_AI_Node} ERROR: iSampleRate is invalid (NaN)');
                return (-1);
            }

            if (strSampleUnit_p == "SAMPLE_UNIT_S")
            {
                // convert sample rate sec -> ms
                iSampleRate *= 1000;
            }

            return (iSampleRate);

        }



        //-------------------------------------------------------------------
        //  Private: Get configured number of decimal places
        //-------------------------------------------------------------------

        function  Ctr700_AI_GetNumOfDecPlaces (strDecPlaces_p)
        {

            var iDecPlaces;

            switch (strDecPlaces_p)
            {
                case "DECPLCE_0":       iDecPlaces =  0;    break;
                case "DECPLCE_1":       iDecPlaces =  1;    break;
                case "DECPLCE_2":       iDecPlaces =  2;    break;
                case "DECPLCE_3":       iDecPlaces =  3;    break;
                case "DECPLCE_ALL":     iDecPlaces = -1;    break;
                default:                iDecPlaces = -1;    break;
            }

            return (iDecPlaces);

        }



        //-------------------------------------------------------------------
        //  Private: Calculate DigitValue from UpperValData/LowerValData
        //-------------------------------------------------------------------

        function  Ctr700_AI_GetDigitValue (flUpperValData_p, flLowerValData_p)
        {

            var flDigitValue = 0.0;

            flDigitValue = (flUpperValData_p - flLowerValData_p) / 32768;

            return (flDigitValue);

        }



        //-------------------------------------------------------------------
        //  Private: Build payload data for message to send
        //-------------------------------------------------------------------

        function  Ctr700_AI_BuildPayloadData (vProcValue_p, strUpperValType_p)
        {

            var vProcData;

            switch (strUpperValType_p)
            {
                case "num":
                {
                    if (typeof(vProcValue_p) == 'string')
                    {
                        try
                        {
                            vProcData = parseFloat(vProcValue_p.replace(',', '.'));         // parseFloat() expects only decimal points, but no commas
                        }
                        catch (ErrInfo)
                        {
                            TraceMsg ('{Ctr700_AI_Node} ERROR: parseFloat(' + vProcValue_p.replace(',', '.') + ') failed!');
                            TraceMsg ('{Ctr700_AI_Node} ERROR: ' + ErrInfo.message);
                        }
                    }
                    else
                    {
                        vProcData = vProcValue_p;
                    }
                    break;
                }

                case "str":
                {
                    vProcData = vProcValue_p.toString();
                    break;
                }
            }

            return (vProcData);

        }



        //-------------------------------------------------------------------
        //  Private: Build topic string for message to send
        //-------------------------------------------------------------------

        function  Ctr700_AI_BuildTopicString (iChannelNumber_p, fAltTopic_p, strAltTopic_p)
        {

            var strTopic;

            // select between default and alternative topic
            if ( !fAltTopic_p )
            {
                strTopic = '/ai/' + iChannelNumber_p.toString();
            }
            else
            {
                strTopic = strAltTopic_p;
            }

            // check if topic is valid
            if (strTopic == null)
            {
                strTopic = "";
            }

            // normalize topic
            strTopic = strTopic.trim();
            strTopic = strTopic.toLowerCase();

            // prevent empty topic
            if (strTopic.length == 0)
            {
                strTopic = 'undefined';
            }

            return (strTopic);

        }



        //-------------------------------------------------------------------
        //  Private: Callback handler for status timer
        //-------------------------------------------------------------------

        function  Ctr700_AI_CbHandlerStatusTimer (iStatusTimerInst_p)
        {

            TraceMsg ('{Ctr700_AI_Node} Ctr700_AI_CbHandlerStatusTimer (' + iStatusTimerInst_p + ')');

            clearTimeout (ThisNode.m_ObjStatusTimer);
            ThisNode.m_ObjStatusTimer = null;
            Ctr700_AI_ShowAdcDataState (ADC_STATE_IDLE);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Show IPC state in editor
        //-------------------------------------------------------------------

        function  Ctr700_AI_ShowAdcDataState (iAdcDataState_p)
        {

            var fStateChanged;
            var strStatMsg;

            TraceMsg ('{Ctr700_AI_Node} Ctr700_AI_ShowAdcDataState: iAdcDataState_p=' + iAdcDataState_p);

            // check if state was changed since last call
            fStateChanged = (iAdcDataState_p == ThisNode.m_iLastAdcDataState) ? false : true;
            ThisNode.m_iLastAdcDataState = iAdcDataState_p;

            // remove status label from node?
            if (iAdcDataState_p == ADC_STATE_UNDEF)
            {
                // an empty status object cleares the status entry from the node
                ThisNode.status ({});
                return;
            }

            // show IPC state in editor
            switch (iAdcDataState_p)
            {
                // -------------------- Active (-> green) ---------------------
                case ADC_STATE_ACTIVE:
                {
                    strStatMsg = 'Altered';
                    ThisNode.status ({fill:'green', shape:'dot', text:strStatMsg});

                    // start timer to clear 'active' status after configured interval
                    if ( ThisNode.m_ObjStatusTimer )
                    {
                        // cancel already running timer from previous call
                        TraceMsg ('{Ctr700_AI_Node} clearTimeout()');
                        clearTimeout (ThisNode.m_ObjStatusTimer);
                    }
                    TraceMsg ('{Ctr700_AI_Node} setTimeout (' + ThisNode.m_iNewDataStatusPeriod + ', ' + ThisNode.m_iStatusTimerInst + ')');
                    ThisNode.m_ObjStatusTimer = setTimeout (Ctr700_AI_CbHandlerStatusTimer, ThisNode.m_iNewDataStatusPeriod, ThisNode.m_iStatusTimerInst);
                    ThisNode.m_iStatusTimerInst++;
                    break;
                }

                // -------------------- Error (-> red) ------------------------
                case ADC_STATE_ERROR:
                {
                    // keep timestamp of first error occurrence
                    if ( !fStateChanged )
                    {
                        return;
                    }

                    strStatMsg = 'Error';
                    ThisNode.status ({fill:'red', shape:'dot', text:strStatMsg});
                    break;
                }

                // -------------------- Idle (-> grey) ------------------------
                case ADC_STATE_IDLE:
                default:
                {
                    // keep timestamp of first idle occurrence
                    if ( !fStateChanged )
                    {
                        return;
                    }

                    strStatMsg = 'Settled';
                    ThisNode.status ({fill:'grey', shape:'dot', text:strStatMsg});
                    break;
                }
            }

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Trace logging message
        //-------------------------------------------------------------------

        function  TraceMsg (strTraceMsg_p, strNodeName_p)
        {

            var fEnable = false;
            var strNodeName;

            // check if any enable option is set
            if ( TRACE_ENABLE_ALL )
            {
                // enable all -> no additional checks necessary
                fEnable = true;
            }
            else if ( TRACE_ENABLE_NODE_NAME_DBG )
            {
                // check if node name is given as runtime parameter to this function
                strNodeName = "";
                if (strNodeName_p !== undefined)
                {
                    // reuse node name given as parameter
                    strNodeName = strNodeName_p;
                }
                else
                {
                    // try to get node name from node configuration
                    // -> evaluate first if 'ThisNode.m_NodeConfig.name' is valid
                    if (ThisNode.m_NodeConfig !== undefined)
                    {
                        if (ThisNode.m_NodeConfig != null)
                        {
                            if ( ThisNode.m_NodeConfig.hasOwnProperty('name') )
                            {
                                if (ThisNode.m_NodeConfig.name != undefined)
                                {
                                    if (ThisNode.m_NodeConfig.name != null)
                                    {
                                        strNodeName = ThisNode.m_NodeConfig.name;
                                    }
                                }
                            }
                        }
                    }
                }

                if (strNodeName.substr(0,4) == 'DBG_')
                {
                    fEnable = true;
                }
            }

            if ( fEnable )
            {
                ThisNode.log (strTraceMsg_p);
            }

            return;

        }


    }   // function  Ctr700_AI_Node (NodeConfig_p)


}   // module.exports = function(RED)




