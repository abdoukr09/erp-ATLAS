const { User } = require('./models');

async function checkUsers() {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'role', 'active', 'failedLoginAttempts', 'lockedUntil']
    });
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUsers();
