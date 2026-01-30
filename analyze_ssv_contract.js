const https = require('https');

async function fetchContractData(address) {
    const rpcUrl = 'https://rpc.ankr.com/eth';
    
    // Get contract bytecode
    const getBytecode = () => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getCode',
                params: [address, 'latest'],
                id: 1
            });

            const options = {
                hostname: 'rpc.ankr.com',
                port: 443,
                path: '/eth',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response.result);
                    } catch (err) {
                        reject(err);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    };

    // Get storage at slot 0 (implementation address in proxy pattern)
    const getStorageAt = (slot) => {
        return new Promise((resolve, reject) => {
            const postData = JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_getStorageAt',
                params: [address, slot, 'latest'],
                id: 2
            });

            const options = {
                hostname: 'rpc.ankr.com',
                port: 443,
                path: '/eth',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response.result);
                    } catch (err) {
                        reject(err);
                    }
                });
            });

            req.on('error', reject);
            req.write(postData);
            req.end();
        });
    };

    try {
        console.log(`Analyzing contract: ${address}\n`);
        
        const bytecode = await getBytecode();
        console.log(`Bytecode length: ${bytecode ? bytecode.length : 'N/A'}`);
        
        if (bytecode && bytecode !== '0x') {
            console.log(`\nBytecode (first 200 chars): ${bytecode.substring(0, 200)}...`);
            
            // Check for common proxy patterns
            const hasDelegate = bytecode.includes('f4'); // DELEGATECALL opcode
            const hasStaticCall = bytecode.includes('fa'); // STATICCALL opcode
            console.log(`\nProxy Pattern Analysis:`);
            console.log(`- Contains DELEGATECALL: ${hasDelegate}`);
            console.log(`- Contains STATICCALL: ${hasStaticCall}`);
            
            // Analyze bytecode for proxy patterns
            if (bytecode.includes('363d3d373d3d3d363d73')) {
                console.log('- Detected: EIP-1167 Minimal Proxy Pattern');
            }
            if (bytecode.includes('3660008037600080366000845af43d6000803e808015')) {
                console.log('- Detected: OpenZeppelin Proxy Pattern');
            }
        }
        
        // Get implementation address from common slots
        console.log(`\nStorage Analysis:`);
        const commonSlots = [
            '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc', // EIP-1967 implementation
            '0x0000000000000000000000000000000000000000000000000000000000000000', // slot 0
            '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'  // EIP-1967 admin
        ];
        
        for (let i = 0; i < commonSlots.length; i++) {
            const storage = await getStorageAt(commonSlots[i]);
            console.log(`Slot ${commonSlots[i]}: ${storage}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fetchContractData('0xDD9BC35aE942eF0cFa76930954a156B3fF30a4E1');