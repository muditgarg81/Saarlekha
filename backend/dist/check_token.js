"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const tokenString = 'fb326d5b2137627520248fd729e8a15e27801808c88d5e8ffb245d90a5bd711e7';
    const token = await prisma_1.prisma.token.findUnique({
        where: { token: tokenString },
        include: { user: true }
    });
    if (!token) {
        console.log('Token not found in database.');
        return;
    }
    console.log('--- Token Details ---');
    console.log('ID:', token.id);
    console.log('Token:', token.token);
    console.log('Type:', token.type);
    console.log('User ID:', token.user_id);
    console.log('Expires At:', token.expires_at);
    console.log('Used At:', token.used_at);
    console.log('Created At:', token.created_at);
    console.log('Current Time:', new Date());
    console.log('Is Expired:', new Date() > token.expires_at);
    console.log('Is Used:', !!token.used_at);
    if (token.user) {
        console.log('--- Associated User ---');
        console.log('Email:', token.user.email);
        console.log('Role:', token.user.role);
        console.log('Company ID:', token.user.company_id);
    }
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma_1.prisma.$disconnect());
