/****************************************************************************

  (c) SYSTEC electronic GmbH, D-08468 Heinsdorfergrund, Am Windrad 2
      www.systec-electronic.com

  Project:      Node-RED Node 'ctr700 switch'
  Description:  Node implementation

  -------------------------------------------------------------------------

  License:

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

    1. Redistributions of source code must retain the above copyright
       notice, this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in the
       documentation and/or other materials provided with the distribution.

    3. Neither the name of SYSTEC electronic GmbH nor the names of its
       contributors may be used to endorse or promote products derived
       from this software without prior written permission. For written
       permission, please contact info@systec-electronic.com.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
    FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
    COPYRIGHT HOLDERS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
    INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
    ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
    POSSIBILITY OF SUCH DAMAGE.

    Severability Clause:

        If a provision of this License is or becomes illegal, invalid or
        unenforceable in any jurisdiction, that shall not affect:
        1. the validity or enforceability in that jurisdiction of any other
           provision of this License; or
        2. the validity or enforceability in other jurisdictions of that or
           any other provision of this License.

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

    const RUN_STOP_SW_CHANNEL_NUMBER = 0x80;        // virtual input channel for Run/Stop switch



    //=======================================================================
    //  Register node to Node-RED nodes palette
    //=======================================================================

    RED.nodes.registerType ("ctr700_switch", Ctr700_Switch_Node);



    //=======================================================================
    //  Node implementation
    //=======================================================================

    function  Ctr700_Switch_Node (NodeConfig_p)
    {

        //-------------------------------------------------------------------
        //  Node main function
        //-------------------------------------------------------------------

        let ThisNode = this;

        // create new node instance
        RED.nodes.createNode (this, NodeConfig_p);

        // register handler for event type 'input'
        ThisNode.on ('input', Ctr700_Switch_NodeHandler_OnInput);

        // register handler for event type 'close'
        ThisNode.on ('close', Ctr700_Switch_NodeHandler_OnClose);

        // register one-time handler for sending the initial value
        ThisNode.m_injectImmediate = setImmediate(function()
        {
            Ctr700_Switch_NodeHandler_OnNodesStarted();
        });

        // run handler for event type 'open'
        Ctr700_Switch_NodeHandler_OnOpen (NodeConfig_p);

        return;



        //-------------------------------------------------------------------
        //  Node event handler [NODE / OPEN]
        //-------------------------------------------------------------------

        function  Ctr700_Switch_NodeHandler_OnOpen (NodeConfig_p)
        {

            var strName;
            var strActType;
            var strActData;
            var strInactType;
            var strInactData;
            var fAltTopic;
            var strAltTopic;

            ThisNode.m_NodeConfig = NodeConfig_p;
            TraceMsg ('{Ctr700_Switch_Node} creating...');

            // create and initialize members
            ThisNode.m_strActType = "";
            ThisNode.m_strActData = "";
            ThisNode.m_strInactType = "";
            ThisNode.m_strInactData = "";
            ThisNode.m_strTopic = "";
            ThisNode.m_strName = "";

            // create I/O driver instance
            TraceMsg ('{Ctr700_Switch_Node} new ctr700drv.Ctr700Drv');
            ThisNode.m_ObjCtr700Drv = new ctr700drv.Ctr700Drv;

            // initialize I/O driver instance
            TraceMsg ('{Ctr700_Switch_Node} ObjCtr700Drv.init()');
            ThisNode.m_ObjCtr700Drv.init();

            // get node configuration
            strActType   = ThisNode.m_NodeConfig.acttype;
            strActData   = ThisNode.m_NodeConfig.actdata;
            strInactType = ThisNode.m_NodeConfig.inacttype;
            strInactData = ThisNode.m_NodeConfig.inactdata;
            fAltTopic    = ThisNode.m_NodeConfig.optalttopic;
            strAltTopic  = ThisNode.m_NodeConfig.alttopic;
            strName      = ThisNode.m_NodeConfig.name;

            TraceMsg ('{Ctr700_Switch_Node} strActType    ' + strActType);
            TraceMsg ('{Ctr700_Switch_Node} strActData:   ' + strActData);
            TraceMsg ('{Ctr700_Switch_Node} strInactType: ' + strInactType);
            TraceMsg ('{Ctr700_Switch_Node} strInactData: ' + strInactData);
            TraceMsg ('{Ctr700_Switch_Node} fAltTopic:    ' + fAltTopic);
            TraceMsg ('{Ctr700_Switch_Node} strAltTopic:  ' + strAltTopic);
            TraceMsg ('{Ctr700_Switch_Node} strName:      ' + strName);

            // get payload specification
            ThisNode.m_strActType   = strActType;
            ThisNode.m_strActData   = strActData;
            ThisNode.m_strInactType = strInactType;
            ThisNode.m_strInactData = strInactData;

            // get topic for publishing input channel state messages
            ThisNode.m_strTopic = Ctr700_Switch_BuildTopicString (fAltTopic, strAltTopic);
            TraceMsg ('{Ctr700_Switch_Node} m_strTopic: ' + ThisNode.m_strTopic);

            // get node name
            ThisNode.m_strName = strName;

            // register I/O driver callback handler to input channel
            const fRisingEdge = true;
            const fFallingEdge = true;
            TraceMsg ('{Ctr700_Switch_Node} ObjCtr700Drv.registerInterrupt(' + RUN_STOP_SW_CHANNEL_NUMBER + ')');
            ThisNode.m_ObjCtr700Drv.registerInterrupt(RUN_STOP_SW_CHANNEL_NUMBER, fRisingEdge, fFallingEdge, Ctr700_Switch_CbHandlerInputChannelStateChanged);

            // publishing initial input channel state is done in callback function 'Ctr700_Switch_NodeHandler_OnNodesStarted()'

            return;

        }



        //-------------------------------------------------------------------
        //  Node event handler [NODE / CLOSE]
        //-------------------------------------------------------------------

        function  Ctr700_Switch_NodeHandler_OnClose ()
        {

            TraceMsg ('{Ctr700_Switch_Node} closing...');

            // clear immediate timeout
            if (ThisNode.m_injectImmediate)
            {
                clearImmediate(ThisNode.m_injectImmediate);
            }

            // unregister callback handler to input channel
            TraceMsg ('{Ctr700_Switch_Node} ObjCtr700Drv.unregisterInterrupt(' + RUN_STOP_SW_CHANNEL_NUMBER + ')');
            ThisNode.m_ObjCtr700Drv.unregisterInterrupt(RUN_STOP_SW_CHANNEL_NUMBER);

            // shutdown driver instance
            TraceMsg ('{Ctr700_Switch_Node} ObjCtr700Drv.shutDown()');
            ThisNode.m_ObjCtr700Drv.shutDown();

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [NODE / EVENT_INPUT]
        //-------------------------------------------------------------------

        function  Ctr700_Switch_NodeHandler_OnInput (Msg_p)
        {

            TraceMsg ('{Ctr700_Switch_Node} procesing input message...');

            // This node is an input node and therefore it does not process any messages

            return;

        };



        //-------------------------------------------------------------------
        //  Node event handler [EVENTS / NODE_STARTED]
        //-------------------------------------------------------------------

        function  Ctr700_Switch_NodeHandler_OnNodesStarted ()
        {

            var fChannelValue;

            TraceMsg ('{Ctr700_Switch_Node} process initial input state...');

            // publish initial input channel state
            TraceMsg ('{Ctr700_Switch_Node} ObjCtr700Drv.getRunSwitch()');
            fChannelValue = ThisNode.m_ObjCtr700Drv.getRunSwitch();

            TraceMsg ('{Ctr700_Switch_Node} initial state -> fChannelValue: ' + fChannelValue.toString());
            Ctr700_Switch_PublishInputChannelState (fChannelValue);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Callback handler for input channel state changes
        //-------------------------------------------------------------------

        function  Ctr700_Switch_CbHandlerInputChannelStateChanged (iChannelNumber_p, iChannelValue_p)
        {

            TraceMsg ('{Ctr700_Switch_Node} Ctr700_Switch_CbHandlerInputChannelStateChanged: iChannelNumber_p=' + iChannelNumber_p + ', iChannelValue_p=' + iChannelValue_p);

            // check if received channel number matches to configured channel number
            if (iChannelNumber_p != RUN_STOP_SW_CHANNEL_NUMBER)
            {
                // mismatch in channel number -> abort processing
                TraceMsg ('{Ctr700_Switch_Node} ERROR: Channel Mismatch (' + iChannelNumber_p + ' <> ' + RUN_STOP_SW_CHANNEL_NUMBER + ') -> Ignore Message');
                return;
            }

            Ctr700_Switch_PublishInputChannelState (iChannelValue_p);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Publish input channel state
        //-------------------------------------------------------------------

        function  Ctr700_Switch_PublishInputChannelState (iChannelValue_p)
        {

            var fChannelValue;
            var vChannelData;
            var Msg = { topic: "", payload: 0 };

            TraceMsg ('{Ctr700_Switch_Node} Ctr700_Switch_PublishInputChannelState: iChannelValue_p=' + iChannelValue_p);

            // get input channel value
            fChannelValue = iChannelValue_p ? true : false;

            // show input channel state in editor
            if ( fChannelValue )
            {
                ThisNode.status ({fill:"green", shape:"dot", text:"Run"});
            }
            else
            {
                ThisNode.status ({fill:"grey", shape:"ring", text:"Stop"});
            }

            // build payload data for message to send
            vChannelData = Ctr700_Switch_BuildPayloadData (fChannelValue, ThisNode.m_strActType, ThisNode.m_strActData, ThisNode.m_strInactType, ThisNode.m_strInactData);

            // send message
            Msg.topic   = ThisNode.m_strTopic;
            Msg.payload = vChannelData;
            TraceMsg ('{Ctr700_Switch_Node} SendMsg (topic=' + Msg.topic + ', payload=' + Msg.payload.toString() + ')');
            ThisNode.send (Msg);

            return;

        }



        //-------------------------------------------------------------------
        //  Private: Build payload data for message to send
        //-------------------------------------------------------------------

        function  Ctr700_Switch_BuildPayloadData (fChannelValue_p, strActType_p, strActData_p, strInactType_p, strInactData_p)
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

        function  Ctr700_Switch_BuildTopicString (fAltTopic_p, strAltTopic_p)
        {

            var strTopic;

            // select between default and alternative topic
            if ( !fAltTopic_p )
            {
                strTopic = '/switch';
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


    }   // function  Ctr700_Switch_Node (NodeConfig_p)


}   // module.exports = function(RED)




