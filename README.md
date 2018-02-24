# p-by-p

Packet-By-Packet, a pcap reader inspired by line-by-line and pcap-reader

## Installation

```bash
npm install p-by-p
```

## Usage

```js
const PacketByPacket = require('p-by-p')
const readline = require('readline')

const pbyp = PacketByPacket('/path/to/file.pcap')
// setup event handler
pbyp.on('globalHeader', gh => {
  // process pcap file global header
})
pbyp.on('packet', p => {
  // process your packet data

  // you can also stop/resume the reader
  pbyp.pause()
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question(`Do you want to resume?`, (answer) => {
    pbyp.resume()
    rl.close()
  })
})
pbyp.on('end', () => {
  // no more data
})
pbyp.on('error', err => {})
// start it
pbyp.resume()
```
