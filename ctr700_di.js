/****************************************************************************

  (c) SYSTEC electronic AG, D-08468 Heinsdorfergrund, Am Windrad 2
      www.systec-electronic.com

  Project:      Node-RED Node 'ctr700 di'
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

    RED.nodes.registerType ("ctr700_di", Ctr700_DI_Node);



    //=======================================================================
    //  Node implementation
    //=======================================================================

    function  Ctr700_DI_Node (NodeConfig_p)
    {

        //-------------------------------------------------------------------
        //  Node main function
        //-------------------------------------------------------------------

        let ThisNode = this;

        // create new node instance
        RED.nodes.createNode (this, NodeConfig_p);

        // register handler for event type 'input'
        ThisNode.on ('input', Ctr700_DI_NodeHandler_OnInput);

        // register handler for event type 'close'
        ThisNode.on ('close', Ctr700_DI_NodeHandler_OnClose);

        // register one-time handler for sending the initial value
        ThisNode.m_injectImmediate = setImmediate(function()
        {
            Ctr700_DI_NodeHandler_OnNodesStarted();
        });

        // run handler for event type 'open'
        Ctr700_DI_NodeHandler_OnOpen (NodeConfig_p);

        return;



        //-------------------------------------------------------------------
        //  Node event handler [NODE / OPEN]
        //-------------------------------------------------------------------

        function  Ctr700_DI_NodeHandler_OnOpen (NodeConfig_p)
        {

            var strName;
            var strChannel;
            var strEdge;
            var strActType;
            var strActData;
            var strInactType;
            var strInactData;
            var fAltTopic;
            var strAltTopic;

            ThisNode.m_NodeConfig = NodeConfig_p;
            TraceMsg ('{Ctr700_DI_Node} creating...');

            // create and initialize members
            ThisNode.m_iChannelNumber = -1;
            ThisNode.m_strActType = "";
            ThisNode.m_strActData = "";
            ThisNode.m_strInactType = "";
            ThisNode.m_strInactData = "";
            ThisNode.m_strTopic = "";
            ThisNode.m_strName = "";

            // create I/O driver instance
            TraceMsg ('{Ctr700_DI_Node} new ctr700drv.Ctr700Drv');
            ThisNode.m_ObjCtr700Drv = new ctr700drv.Ctr700Drv;

            // initialize I/O driver instance
            TraceMsg ('{Ctr700_DI_Node} ObjCtr700Drv.init()');
            ThisNode.m_ObjCtr700Drv.init();

            // get node configuration
            strChannel   = ThisNode.m_NodeConfig.channel;
            strEdge      = ThisNode.m_NodeConfig.edge;
            strActType   = ThisNode.m_NodeConfig.acttype;
            strActData   = ThisNode.m_NodeConfig.actdata;
            strInactType = ThisNode.m_NodeConfig.inacttype;
            strInactData = ThisNode.m_NodeConfig.inactdata;
            fAltTopic    = ThisNode.m_NodeConfig.optalttopic;
            strAltTopic  = ThisNode.m_NodeConfig.alttopic;
            strName      = ThisNode.m_NodeConfig.name;

            TraceMsg ('{Ctr700_DI_Node} strChannel:   ' + strChannel);
            TraceMsg ('{Ctr700_DI_Node} strEdge:      ' + strEdge);
            TraceMsg ('{Ctr700_DI_Node} strActType    ' + strActType);
            TraceMsg ('{Ctr700_DI_Node} strActData:   ' + strActData);
            TraceMsg ('{Ctr700_DI_Node} strInactType: ' + strInactType);
            TraceMsg ('{Ctr700_DI_Node} strInactData: ' + strInactData);
            TraceMsg ('{Ctr700_DI_Node} fAltTopic:    ' + fAltTopic);
            TraceMsg ('{Ctr700_DI_Node} strAltTopic:  ' + strAltTopic);
            TraceMsg ('{Ctr700_DI_Node} strName:      ' + strName);

            // get input channel number
            ThisNode.m_iChannelNumber = Ctr700_DI_GetInputChannelNumber (strChannel);
            TraceMsg ('{Ctr700_DI_Node} m_iChannelNumber: ' + ThisNode.m_iChannelNumber);

            // get input channel edge
            ThisNode.m_strEdge = strEdge;

            // get payload specification
            ThisNode.m_strActType   = strActType;
            ThisNode.m_strActData   = strActData;
            ThisNode.m_strInactType = strInactType;
            ThisNode.m_strInactData = strInactData;

            // get topic for publishing input channel state messages
            ThisNode.m_strTopic = Ctr700_DI_BuildTopicString (ThisNode.m_iChannelNumber, fAltTopic, strAltTopic);
            TraceMsg ('{Ctr700_DI_Node} m_strTopic: ' + ThisNode.m_strTopic);

            // get node name
            ThisNode.m_strName = strName;

            // register I/O driver callback handler to input channel
            const fRisingEdge = true;
            const fFallingEdge = true;
            TraceMsg ('{Ctr700_DI_Node} ObjCtr700Drv.registerInterrupt(' + ThisNode.m_iChannelNumber + ')');
            ThisNode.m_ObjCtr700Drv.registerInterrupt(ThisNode.m_iChannelNumber, fRisingEdge, fFallingEdge, Ctr700_DI_CbHandlerInputChannelStateChanged);

            // publishing initial input channel state is done in callback function 'Ctr700_DI_NodeHandler_OnNodesStarted()'

            return;

        }



        //-------------------------------------------------------------------
        //  Node event handler [NODE / CLOSE]
        //-------------------------------------------------------------------

        function  Ctr700_DI_NodeHandler_OnClose ()
        {

            TraceMsg ('{Ctr700_DI_Node} closing...');

            // clear immediate timeout
            if (ThisNode.m_injectImmediate)
            {
                clearImmediate(ThisNode.m_injectImmediate);
            }

            // unregister callback handler to input channel
            TraceMsg ('{Ctr700_DI_Node} ObjCtr700Drv.unregisterInterrupt(' + ThisNode.m_iChannelNumber + ')');
            ThisNode.m_ObjCtr700Drv.unregisterInterrupt(ThisNode.m_iChannelNumber);

            // shutdown driver instance
            TraceMsg ('{Ctr700_DI_Node} ObjCtr700Drv.shutDown()');
            ThisNode.m_ObjCtr700Drv.shutDown();

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [NODE / EVENT_INPUT]
        //-------------------------------------------------------------------

        function  Ctr700_DI_NodeHandler_OnInput (Msg_p)
        {

            TraceMsg ('{Ctr700_DI_Node} procesing input message...');

            // This node is an input node and therefore it does not process any messages

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [EVENTS / NODE_STARTED]
        //-------------------------------------------------------------------

        function  Ctr700_DI_NodeHandler_OnNodesStarted ()
        {

            var fChannelValue;

            TraceMsg ('{Ctr700_DI_Node} process initial input state...');

            // publish initial input channel state
            fChannelValue = ThisNode.m_ObjCtr700Drv.getDigitalInput(ThisNode.m_iChannelNumber);
            TraceMsg ('{Ctr700_DI_Node} initial state -> fChannelValue: ' + fChannelValue.toString());
            Ctr700_DI_PublishInputChannelState (ThisNode.m_iChannelNumber, fChannelValue);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Callback handler for input channel state changes
        //-------------------------------------------------------------------

        function  Ctr700_DI_CbHandlerInputChannelStateChanged (iChannelNumber_p, iChannelValue_p)
        {

            TraceMsg ('{Ctr700_DI_Node} Ctr700_DI_CbHandlerInputChannelStateChanged: iChannelNumber_p=' + iChannelNumber_p + ', iChannelValue_p=' + iChannelValue_p);

            Ctr700_DI_PublishInputChannelState (iChannelNumber_p, iChannelValue_p);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Publish input channel state
        //-------------------------------------------------------------------

        function  Ctr700_DI_PublishInputChannelState (iChannelNumber_p, iChannelValue_p)
        {

            var iChannelNumber;
            var fChannelValue;
            var fEdgeMatch;
            var vChannelData;
            var Msg = { topic: "", payload: 0 };

            TraceMsg ('{Ctr700_DI_Node} Ctr700_DI_PublishInputChannelState: iChannelNumber_p=' + iChannelNumber_p + ', iChannelValue_p=' + iChannelValue_p);

            // get node configuration
            iChannelNumber = ThisNode.m_iChannelNumber;
            TraceMsg ('{Ctr700_DI_Node} iChannelNumber: ' + iChannelNumber);

            // check if received channel number matches to configured channel number
            if (iChannelNumber_p != iChannelNumber)
            {
                // mismatch in channel number -> abort processing
                TraceMsg ('{Ctr700_DI_Node} ERROR: Channel Mismatch (' + iChannelNumber_p + ' <> ' + iChannelNumber + ') -> Ignore Message');
                return;
            }

            // get input channel value
            fChannelValue = iChannelValue_p ? true : false;

            // show input channel state in editor (independent from pubishing or supressing message according to edge configurtaion)
            if ( fChannelValue )
            {
                ThisNode.status ({fill:"green", shape:"dot", text:"1"});
            }
            else
            {
                ThisNode.status ({fill:"grey", shape:"dot", text:"0"});
            }

            // check if input state matches to edge configuration
            fEdgeMatch = Ctr700_DI_GetEdgeMatch (fChannelValue, ThisNode.m_strEdge);
            TraceMsg ('{Ctr700_DI_Node} EdgeMatch(' + fChannelValue + ', ' + ThisNode.m_strEdge + ') -> ' + fEdgeMatch.toString());
            if ( !fEdgeMatch )
            {
                // new input state doesn't matches to configured channel edge -> abort processing
                TraceMsg ('{Ctr700_DI_Node} Edge Mismatch -> Ignore input change');
                return;
            }

            // build payload data for message to send
            vChannelData = Ctr700_DI_BuildPayloadData (fChannelValue, ThisNode.m_strActType, ThisNode.m_strActData, ThisNode.m_strInactType, ThisNode.m_strInactData);

            // send message
            Msg.topic   = ThisNode.m_strTopic;
            Msg.payload = vChannelData;
            TraceMsg ('{Ctr700_DI_Node} SendMsg (topic=' + Msg.topic + ', payload=' + Msg.payload.toString() + ')');
            ThisNode.send (Msg);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Get input channel number
        //-------------------------------------------------------------------

        function  Ctr700_DI_GetInputChannelNumber (strChannelName_p)
        {

            var strChannelName;
            var strChannelNumber;
            var iChannelNumber;

            // check if channel name is valid
            if ((strChannelName_p == null) || (strChannelName_p.length == 0))
            {
                ThisNode.error ('{Ctr700_DI_Node} Invalid Output ChannelName (strChannelName_p is null or empty)');
                return (-1);
            }

            // normalize channel name
            strChannelName = strChannelName_p.trim();
            strChannelName = strChannelName.toUpperCase();

            // check for valid prefix
            if ( !strChannelName.startsWith('IN_DI') )
            {
                ThisNode.error ('{Ctr700_DI_Node} Invalid Output ChannelName: ' + strChannelName_p);
                return (-1);
            }

            // get channel number form channel name
            strChannelNumber = strChannelName.substr(5);
            iChannelNumber = parseInt(strChannelNumber);
            if (iChannelNumber === NaN)
            {
                ThisNode.error ('{Ctr700_DI_Node} Invalid Output Channelumber: ' + strChannelNumber);
                return (-1);
            }

            return (iChannelNumber);

        }



        //-------------------------------------------------------------------
        //  Private: Check if input value matches to edge configuration
        //-------------------------------------------------------------------

        function  Ctr700_DI_GetEdgeMatch (fChannelValue_p, strChannelEdge_p)
        {

            var fEdgeMatch = false;

            switch (strChannelEdge_p)
            {
                case "EDGE_BOTH":
                {
                    fEdgeMatch = true;
                    break;
                }

                case "EDGE_RISING":
                {
                    fEdgeMatch = fChannelValue_p ? true : false;
                    break;
                }

                case "EDGE_FALLING":
                {
                    fEdgeMatch = fChannelValue_p ? false : true;
                    break;
                }

                default:
                {
                    fEdgeMatch = false;
                    break;
                }
            }

            return (fEdgeMatch);

        }



        //-------------------------------------------------------------------
        //  Private: Build payload data for message to send
        //-------------------------------------------------------------------

        function  Ctr700_DI_BuildPayloadData (fChannelValue_p, strActType_p, strActData_p, strInactType_p, strInactData_p)
        {

            var strData;
            var vChannelData;

            if ( fChannelValue_p )
            {
                // -------- Active --------
                strData = strActData_p.toLowerCase();
                switch (strActType_p)
                {
                    case "bool":
                    {
                        vChannelData = (strData == "true") ? true : false;
                        break;
                    }

                    case "num":
                    {
                        vChannelData = parseInt (strData, 10);
                        if (vChannelData == NaN)
                        {
                            vChannelData = 0;
                        }
                        break;
                    }

                    case "str":
                    {
                        vChannelData = strData;
                        break;
                    }
                }
            }
            else
            {
                // -------- Inactive --------
                strData = strInactData_p.toLowerCase();
                switch (strInactType_p)
                {
                    case "bool":
                    {
                        vChannelData = (strData == "true") ? true : false;
                        break;
                    }

                    case "num":
                    {
                        vChannelData = parseInt (strData, 10);
                        if (vChannelData == NaN)
                        {
                            vChannelData = 0;
                        }
                        break;
                    }

                    case "str":
                    {
                        vChannelData = strData;
                        break;
                    }
                }
            }

            return (vChannelData);

        }



        //-------------------------------------------------------------------
        //  Private: Build topic string for message to send
        //-------------------------------------------------------------------

        function  Ctr700_DI_BuildTopicString (iChannelNumber_p, fAltTopic_p, strAltTopic_p)
        {

            var strTopic;

            // select between default and alternative topic
            if ( !fAltTopic_p )
            {
                strTopic = '/di/' + iChannelNumber_p.toString();
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


    }   // function  Ctr700_DI_Node (NodeConfig_p)


}   // module.exports = function(RED)




