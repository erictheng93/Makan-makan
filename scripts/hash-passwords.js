// Generate bcrypt hashes for test passwords
const bcrypt = require("bcryptjs");

const passwords = {
  admin123: "",
  owner123: "",
  chef123: "",
  service123: "",
  cashier123: "",
};

console.log("Generating bcrypt hashes...\n");

for (const [password, _] of Object.entries(passwords)) {
  const hash = bcrypt.hashSync(password, 10);
  passwords[password] = hash;
  console.log(
    `${password.slice(0, 2)}${"*".repeat(password.length - 2)}: ${hash}`,
  );
}

console.log("\n\nSQL Update Statements:");
console.log("---\n");

console.log(`-- Update admin password`);
console.log(
  `UPDATE users SET password_hash = '${passwords["admin123"]}' WHERE username = 'admin';\n`,
);

console.log(`-- Update owner passwords`);
console.log(
  `UPDATE users SET password_hash = '${passwords["owner123"]}' WHERE username IN ('owner1', 'owner2');\n`,
);

console.log(`-- Update chef passwords`);
console.log(
  `UPDATE users SET password_hash = '${passwords["chef123"]}' WHERE username IN ('chef1', 'chef2');\n`,
);

console.log(`-- Update service password`);
console.log(
  `UPDATE users SET password_hash = '${passwords["service123"]}' WHERE username = 'service1';\n`,
);

console.log(`-- Update cashier password`);
console.log(
  `UPDATE users SET password_hash = '${passwords["cashier123"]}' WHERE username = 'cashier1';\n`,
);
