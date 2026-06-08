"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("./db/prisma");
async function main() {
    const token = await prisma_1.prisma.token.findFirst({
        where: {
            token: {
                startsWith: 'a4996401'
            }
        }
    });
    if (!token) {
        console.log('Token not found.');
        return;
    }
    console.log('RAW TOKEN:', token);
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma_1.prisma.$disconnect());
