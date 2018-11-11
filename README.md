
## About

The 'node-red-contrib-ctr700-io' is a Node-RED node collection to support I/O access for
the sysWORXX CTR-700 Edge Controller from SYS TEC electronic GmbH
(see https://www.systec-electronic.com/en/products/internet-of-things/sysworxx-ctr-700)


## License

Apache License, Version 2.0
(see http://www.apache.org/licenses/LICENSE-2.0)


## Install

Run the following command in your node-RED user directory (typically `~/.node-red`):

    npm install node-red-contrib-ctr700-io


## Content

ctr700_di:      node to handle digital inputs
ctr700_do:      node to handle digital outputs
ctr700_ai:      node to handle analog inputs
ctr700_led:     node to handle run and error led of the module
ctr700_switch:  node to handle run/stop switch of the module


## Node status

The state of the nodes is indicated by a status object (dot, grey/green/red) and text
(depending on function)


