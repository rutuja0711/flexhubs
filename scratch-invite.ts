import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) {
    console.error("No organization found.");
    return;
  }
  
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No users found to send the invite from.");
    return;
  }

  const email = "rutuja@flexodynsolutions.com";

  console.log(`Found Org: ${org.name || org.id}`);
  console.log(`Found User (Sender): ${user.email || user.id}`);

  // Create or update invite
  const invite = await prisma.organizationInvite.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: email
      }
    },
    update: {
      status: "PENDING",
      grantAdmin: false
    },
    create: {
      organizationId: org.id,
      email: email,
      invitedById: user.id,
      grantAdmin: false,
      status: "PENDING"
    }
  });

  console.log("Successfully created/updated invite:", invite);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
