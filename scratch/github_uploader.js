import fs from 'fs';
import path from 'path';

const TOKEN = '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';
const OWNER = 'hazemmohie';
const REPO = 'crm-system';
const BRANCH = 'main';

const IGNORE_PATHS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  '.DS_Store',
  'service-account.json',
  'scratch'
];

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    if (IGNORE_PATHS.includes(file)) return;
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

async function uploadFile(filePath, rootDir) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, { encoding: 'base64' });

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${relativePath}`;
  
  // Check if file exists to get sha
  let sha = undefined;
  try {
    const checkRes = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'Uploader'
      }
    });
    if (checkRes.ok) {
      const data = await checkRes.json();
      sha = data.sha;
    }
  } catch (e) {}

  const body = {
    message: `Upload ${relativePath}`,
    content: content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Uploader'
    },
    body: JSON.stringify(body)
  });

  if (res.ok) {
    console.log(`✅ Uploaded: ${relativePath}`);
  } else {
    const err = await res.json();
    console.error(`❌ Failed ${relativePath}:`, err.message);
  }
}

async function main() {
  const rootDir = process.cwd();
  console.log('🚀 Starting bulk upload to GitHub...');
  const files = getAllFiles(rootDir);
  console.log(`Found ${files.length} files to upload.`);

  for (const file of files) {
    await uploadFile(file, rootDir);
  }
  console.log('🎉 Upload complete!');
}

main();
