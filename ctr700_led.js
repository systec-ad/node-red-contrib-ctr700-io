/****************************************************************************

  (c) SYSTEC electronic AG, D-08468 Heinsdorfergrund, Am Windrad 2
      www.systec-electronic.com

  Project:      Node-RED Node 'ctr700 led'
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

    const TRACE_ENABLE_ALL           = false;       // Enables traces for all nodes
    const TRACE_ENABLE_NODE_NAME_DBG = true;        // Enables traces only for nodes which node names starts with 'DBG_'



    //=======================================================================
    //  Register node to Node-RED nodes palette
    //=======================================================================

    RED.nodes.registerType ("ctr700_led", Ctr700_LED_Node);



    //=======================================================================
    //  Node implementation
    //=======================================================================

    function  Ctr700_LED_Node (NodeConfig_p)
    {

        //-------------------------------------------------------------------
        //  Node main function
        //-------------------------------------------------------------------

        let ThisNode = this;

        // create new node instance
        RED.nodes.createNode (this, NodeConfig_p);

        // register handler for event type 'input'
        ThisNode.on ('input', Ctr700_LED_NodeHandler_OnInput);

        // register handler for event type 'close'
        ThisNode.on ('close', Ctr700_LED_NodeHandler_OnClose);

        // register one-time handler for sending the initial value
        ThisNode.m_injectImmediate = setImmediate(function()
        {
            Ctr700_LED_NodeHandler_OnNodesStarted();
        });

        // run handler for event type 'open'
        Ctr700_LED_NodeHandler_OnOpen (NodeConfig_p);

        return;



        //-------------------------------------------------------------------
        //  Node event handler [NODE / OPEN]
        //-------------------------------------------------------------------

        function  Ctr700_LED_NodeHandler_OnOpen (NodeConfig_p)
        {

            var strName;
            var strLed;
            var strInitState;
            var fInitState;
            var strActType;
            var strActData;
            var strInactType;
            var strInactData;
            var fAltTopic;
            var strAltTopic;

            ThisNode.m_NodeConfig = NodeConfig_p;
            TraceMsg ('{Ctr700_LED_Node} creating...');

            // create and initialize members
            ThisNode.m_strLed = "";
            ThisNode.m_strActType = "";
            ThisNode.m_strActData = "";
            ThisNode.m_strInactType = "";
            ThisNode.m_strInactData = "";
            ThisNode.m_strTopic = "";
            ThisNode.m_strName = "";

            // create I/O driver instance
            TraceMsg ('{Ctr700_LED_Node} new ctr700drv.Ctr700Drv');
            ThisNode.m_ObjCtr700Drv = new ctr700drv.Ctr700Drv;

            // initialize I/O driver instance
            TraceMsg ('{Ctr700_LED_Node} ObjCtr700Drv.init()');
            ThisNode.m_ObjCtr700Drv.init();

            // get node configuration
            strLed       = ThisNode.m_NodeConfig.led;
            strInitState = ThisNode.m_NodeConfig.initstate;
            strActType   = ThisNode.m_NodeConfig.acttype;
            strActData   = ThisNode.m_NodeConfig.actdata;
            strInactType = ThisNode.m_NodeConfig.inacttype;
            strInactData = ThisNode.m_NodeConfig.inactdata;
            fAltTopic    = ThisNode.m_NodeConfig.optalttopic;
            strAltTopic  = ThisNode.m_NodeConfig.alttopic;
            strName      = ThisNode.m_NodeConfig.name;

            TraceMsg ('{Ctr700_LED_Node} strLed:       ' + strLed);
            TraceMsg ('{Ctr700_LED_Node} strInitState: ' + strInitState);
            TraceMsg ('{Ctr700_LED_Node} strActType    ' + strActType);
            TraceMsg ('{Ctr700_LED_Node} strActData:   ' + strActData);
            TraceMsg ('{Ctr700_LED_Node} strInactType: ' + strInactType);
            TraceMsg ('{Ctr700_LED_Node} strInactData: ' + strInactData);
            TraceMsg ('{Ctr700_LED_Node} fAltTopic:    ' + fAltTopic);
            TraceMsg ('{Ctr700_LED_Node} strAltTopic:  ' + strAltTopic);
            TraceMsg ('{Ctr700_LED_Node} strName:      ' + strName);

            // get LED
            ThisNode.m_strLed = strLed;

            // get init state
            fInitState = Ctr700_LED_GetInitState (strInitState);
            TraceMsg ('{Ctr700_LED_Node} fInitState: ' + fInitState);

            // get payload specification
            ThisNode.m_strActType   = strActType;
            ThisNode.m_strActData   = strActData;
            ThisNode.m_strInactType = strInactType;
            ThisNode.m_strInactData = strInactData;

            // get topic for messages to accept and process
            ThisNode.m_strTopic = Ctr700_LED_BuildTopicString (ThisNode.m_strLed, fAltTopic, strAltTopic);
            TraceMsg ('{Ctr700_LED_Node} m_strTopic: ' + ThisNode.m_strTopic);

            // get node name
            ThisNode.m_strName = strName;

            // set output to init state
            TraceMsg ('{Ctr700_LED_Node} initial output state: ' + fInitState.toString());
            Ctr700_LED_SetState (ThisNode.m_strLed, fInitState);

            return;

        }



        //-------------------------------------------------------------------
        //  Node event handler [NODE / CLOSE]
        //-------------------------------------------------------------------

        function  Ctr700_LED_NodeHandler_OnClose ()
        {

            TraceMsg ('{Ctr700_LED_Node} closing...');

            // clear immediate timeout
            if (ThisNode.m_injectImmediate)
            {
                clearImmediate(ThisNode.m_injectImmediate);
            }

            // set output to inactive
            TraceMsg ('{Ctr700_LED_Node} set output inactive: ' + ThisNode.m_strLed);
            Ctr700_LED_SetState (ThisNode.m_strLed, false);

            // shutdown driver instance
            TraceMsg ('{Ctr700_LED_Node} ObjCtr700Drv.shutDown()');
            ThisNode.m_ObjCtr700Drv.shutDown();

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [NODE / EVENT_INPUT]
        //-------------------------------------------------------------------

        function  Ctr700_LED_NodeHandler_OnInput (Msg_p)
        {

            var fTopicMatch;
            var strLed;
            var iLedValue;
            var fLedState;

            TraceMsg ('{Ctr700_LED_Node} processing input message...');
            TraceMsg ('{Ctr700_LED_Node} Msg_p.topic: ' + Msg_p.topic);
            TraceMsg ('{Ctr700_LED_Node} Msg_p.payload: ' + Msg_p.payload);

            // check if received message matches to configured topic
            fTopicMatch = Ctr700_LED_IsTopicMatch (ThisNode.m_strTopic, Msg_p.topic);
            TraceMsg ('{Ctr700_LED_Node} TopicMatch(' + ThisNode.m_strTopic + ', ' + Msg_p.topic + ') -> ' + fTopicMatch.toString());
            if ( !fTopicMatch )
            {
                // received message doesn't match to configured topic -> abort processing
                TraceMsg ('{Ctr700_LED_Node} Topic Mismatch -> Ignore Message');
                return;
            }

            // get LED
            strLed = ThisNode.m_strLed;
            TraceMsg ('{Ctr700_LED_Node} strLed: ' + strLed);

            // get LED value from message
            iLedValue = Ctr700_LED_GetLedValue (Msg_p.payload);
            TraceMsg ('{Ctr700_LED_Node} LedValue(' + Msg_p.payload + ') -> ' + iLedValue.toString());
            if (iLedValue < 0)
            {
                // received message doesn't match to configured values -> abort processing
                TraceMsg ('{Ctr700_LED_Node} Value Mismatch -> Ignore Message');
                return;
            }

            // set LED to received state
            fLedState = (iLedValue == 1) ? true : false;
            Ctr700_LED_SetState (strLed, fLedState);

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [EVENTS / NODE_STARTED]
        //-------------------------------------------------------------------

        function  Ctr700_LED_NodeHandler_OnNodesStarted ()
        {

            TraceMsg ('{Ctr700_LED_Node} process initial input state...');

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Set LED state
        //-------------------------------------------------------------------

        function  Ctr700_LED_SetState (strLed_p, fLedState_p)
        {

            switch (strLed_p)
            {
                case 'LED_RUN':
                {
                    TraceMsg ('{Ctr700_LED_Node} ObjCtr700Drv.setRunLed(' + fLedState_p + ')');
                    ThisNode.m_ObjCtr700Drv.setRunLed(fLedState_p);

                    // show LED state in editor
                    if ( fLedState_p )
                    {
                        ThisNode.status ({fill:"green", shape:"dot", text:"1"});
                    }
                    else
                    {
                        ThisNode.status ({fill:"grey", shape:"dot", text:"0"});
                    }

                    break;
                }

                case 'LED_ERR':
                {
                    TraceMsg ('{Ctr700_LED_Node} ObjCtr700Drv.setErrLed(' + fLedState_p + ')');
                    ThisNode.m_ObjCtr700Drv.setErrorLed(fLedState_p);

                    // show LED state in editor
                    if ( fLedState_p )
                    {
                        ThisNode.status ({fill:"red", shape:"dot", text:"1"});
                    }
                    else
                    {
                        ThisNode.status ({fill:"grey", shape:"dot", text:"0"});
                    }

                    break;
                }

                default:
                {
                    // unknown LED
                    TraceMsg ('{Ctr700_LED_Node} invalid LED (strLed_p=' + strLed_p + ')');
                    return;
                }
            }

            return;

        };



        //-------------------------------------------------------------------
        //  Private: Get init state
        //-------------------------------------------------------------------

        function  Ctr700_LED_GetInitState (strInitState_p)
        {

            if (strInitState_p == 'INIT_STATE_ACTIVE')
            {
                return (true);
            }

            return (false);

        }



        //-------------------------------------------------------------------
        //  Private: Build topic string for messages to accept and process
        //-------------------------------------------------------------------

        function  Ctr700_LED_BuildTopicString (strLed_p, fAltTopic_p, strAltTopic_p)
        {

            var strTopic;

            // select between default and alternative topic
            if ( !fAltTopic_p )
            {
                strTopic = '/' + strLed_p;
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

            return (strTopic);

        }



        //-------------------------------------------------------------------
        //  Private: Check if mesage topic matches to configured topic
        //-------------------------------------------------------------------

        function  Ctr700_LED_IsTopicMatch (strCfgNodeTopic_p, strRecvMsgTopic_p)
        {

            var strRecvMsgTopic;

            // check if received topic is valid
            if ((strRecvMsgTopic_p == null) || (strRecvMsgTopic_p.length == 0))
            {
                return (false);
            }

            // normalize received topic
            strRecvMsgTopic = strRecvMsgTopic_p.trim();
            strRecvMsgTopic = strRecvMsgTopic.toLowerCase();

            // check for wildcard topic
            if (strCfgNodeTopic_p == '#')
            {
                return (true);
            }

            // check if mesage topic matches to configured topic
            if (strRecvMsgTopic_p == strCfgNodeTopic_p)
            {
                return (true);
            }

            return (false);

        }



        //-------------------------------------------------------------------
        //  Private: Get LED value from received message payload
        //-------------------------------------------------------------------

        function  Ctr700_LED_GetLedValue (vLedValue_p)
        {

            // evaluate LED state type and value from received message payload
            switch (typeof vLedValue_p)
            {
                // -------- Boolean --------
                case "boolean":
                {
                    TraceMsg ('{Ctr700_LED_Node} typeof vLedValue_p -> boolean');
                    if (ThisNode.m_strActType == 'bool')
                    {
                        if (vLedValue_p.toString() == ThisNode.m_strActData.toLowerCase())
                        {
                            return (1);     // set output to state 'ON'
                        }
                    }
                    if (ThisNode.m_strInactType == 'bool')
                    {
                        if (vLedValue_p.toString() == ThisNode.m_strInactData.toLowerCase())
                        {
                            return (0);     // set output to state 'OFF'
                        }
                    }
                    return (-1);            // received message doesn't match to configured values -> irgnore message
                }
                
                // -------- Number --------
                case "number":
                {
                    TraceMsg ('{Ctr700_LED_Node} typeof vLedValue_p -> number');
                    if (ThisNode.m_strActType == 'num')
                    {
                        if (vLedValue_p.toString() == ThisNode.m_strActData.toLowerCase())
                        {
                            return (1);     // set output to state 'ON'
                        }
                    }
                    if (ThisNode.m_strInactType == 'num')
                    {
                        if (vLedValue_p.toString() == ThisNode.m_strInactData.toLowerCase())
                        {
                            return (0);     // set output to state 'OFF'
                        }
                    }
                    return (-1);            // received message doesn't match to configured values -> irgnore message
                }

                // -------- String --------
                case "string":
                {
                    TraceMsg ('{Ctr700_LED_Node} typeof vLedValue_p -> string');
                    if (ThisNode.m_strActType == 'str')
                    {
                        if (vLedValue_p.toLowerCase() == ThisNode.m_strActData.toLowerCase())
                        {
                            return (1);     // set output to state 'ON'
                        }
                    }
                    if (ThisNode.m_strInactType == 'str')
                    {
                        if (vLedValue_p.toLowerCase() == ThisNode.m_strInactData.toLowerCase())
                        {
                            return (0);     // set output to state 'OFF'
                        }
                    }
                    return (-1);            // received message doesn't match to configured values -> irgnore message
                }

                // -------- All Other --------
                default:
                {
                    return (-1);            // received message doesn't match to configured values -> irgnore message
                }
            }                

            return (-1);

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


    }   // function  Ctr700_LED_Node (NodeConfig_p)


}   // module.exports = function(RED)




