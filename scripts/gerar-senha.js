// Gera o hash da senha de admin para colocar no Vercel
// Uso: node scripts/gerar-senha.js SUA_SENHA_AQUI
const bcrypt = require('bcryptjs');
const senha = process.argv[2];
if (!senha || senha.length < 8) {
  console.error('Erro: informe uma senha com ao menos 8 caracteres.');
  console.error('Uso: node scripts/gerar-senha.js SUA_SENHA');
  process.exit(1);
}
bcrypt.hash(senha, 12).then(hash => {
  console.log('\nCopie e cole isso no Vercel → Settings → Environment Variables:\n');
  console.log('ADMIN_PASSWORD_HASH=' + hash);
  console.log('\nTambém adicione uma chave secreta aleatória:');
  const rand = require('crypto').randomBytes(32).toString('hex');
  console.log('ADMIN_JWT_SECRET=' + rand);
});
