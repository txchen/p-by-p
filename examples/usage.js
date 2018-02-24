const PacketByPacket = require('../p-by-p')

const pbyp = PacketByPacket('./malformat.pcap')
pbyp.on('end', () => console.log('--- read ended'))
pbyp.on('packet', data => console.log(data))
pbyp.on('error', err => console.log(`ERROR: ${err}`))

//pbyp.resume()
setTimeout(() => {
  pbyp.resume()
}, 1000)