const PacketByPacket = require('../p-by-p')
const readline = require('readline')

let receivedPacket = 0
const pbyp = PacketByPacket('./sample.pcap')
pbyp.on('end', (result) => console.log('--- read ended. Result:', result))
pbyp.on('packet', p => {
  console.log('got packet:', p)
  receivedPacket++
  if (receivedPacket % 15 === 0) {
    pbyp.pause()
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })
    rl.question(`\nGot ${receivedPacket} packets already, do you want to continue? Enter to resume`, (answer) => {
      pbyp.resume()
      rl.close()
    })
  }
})
pbyp.on('globalHeader', gh => {
  console.log('GlobalHeader:', gh)
})
pbyp.on('error', err => console.log(`ERROR: ${err}`))

setTimeout(() => {
  pbyp.resume()
}, 100)