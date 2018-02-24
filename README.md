# p-by-p

Packet-By-Packet, a pcap reader inspired by line-by-line and pcap-reader

## Installation

```bash
npm install p-by-p
```

## Usage

```js
const PacketByPacket = require('p-by-p')

const pbyp = PacketByPacket('/path/to/file.pcap')
// setup event handler
pbyp.on('packet', p => {
  // process your packet data
})
pbyp.on('end', () => {
  // no more data
})
pbyp.on('error', err => {})
// start it
pbyp.resume()
```
