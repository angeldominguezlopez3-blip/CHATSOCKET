const net = require("net")
const readline = require('readline-sync')
const server = {
    port: 3000,
    host: 'localhost'
}

const client = net.createConnection(server);

client.on('connect', ()=>{
    console.log('Cliente conectado al servidor');
    while(true){
        const message = readline.question('Escribe tu mensaje al servidor: ')
        client.write(message + '\n');
    }
})
client.on('data', (data)=>{
    console.log('El servidor dice: ', data.toString());
})

client.on('error', (err)=>{
    console.log('Error:', err())
})