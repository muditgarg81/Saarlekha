import http from 'http';

const data = JSON.stringify({
  token: 'a4996401c0929ee9bd44a0e7573400677d44580496c7a510c42d26e3272e163e',
  password: 'Password123'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/setup-password',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
