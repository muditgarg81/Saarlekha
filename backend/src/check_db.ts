import { prisma } from './db/prisma';

async function main() {
  const companies = await prisma.company.findMany();
  const departments = await prisma.department.findMany();
  const users = await prisma.user.findMany({ include: { company: true } });
  
  console.log('--- Database Dump ---');
  console.log('Companies:', companies.map(c => ({ id: c.id, name: c.name })));
  console.log('Departments:', departments.map(d => ({ id: d.id, name: d.name, companyId: d.company_id })));
  console.log('Users:', users.map(u => ({ id: u.id, email: u.email, role: u.role, companyId: u.company_id, companyName: u.company?.name })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
