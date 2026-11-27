import fs from 'node:fs';
// Remove only the obsolete static entrypoint; Worker now serves the page and API.
if(fs.existsSync('dist/index.html'))fs.unlinkSync('dist/index.html');
const data=JSON.parse(fs.readFileSync('data.json','utf8'));
const clientFiles=[
 'profiles-client.js','todos-client.js','status-client.js','list-order-client.js','interview-feedback-client.js'
];
const clientScripts=[
 fs.readFileSync('client-extra.js','utf8').replace(/loadState\(\);\s*$/, ''),
 ...clientFiles.map(name=>fs.readFileSync(name,'utf8')),
 'loadState();','</script>'
].join('\n');
const html=fs.readFileSync('template.html','utf8')
 .replace(/let REVIEW=\{\},LINKS=\{\};[\s\S]*?<\/script>/,()=>clientScripts)
 .replace('</style>','.reviewfilters [aria-pressed=true]{background:#176b66;color:white}.reviewdone{background:#edf0f3;border-color:#d2d9e0;color:#596675}.reviewdone .badge{background:#dce2e8;color:#4b5968}</style>')
 .replace('/*DATA*/',JSON.stringify(data).replaceAll('<','\\u003c'));
fs.mkdirSync('dist/server',{recursive:true});
const workerFiles=['interview-feedback.mjs','worker.mjs'];
const workerScripts=workerFiles.map(name=>fs.readFileSync(name,'utf8')).join('\n');
fs.writeFileSync('dist/server/index.js',workerScripts+'\nexport default createWorker('+JSON.stringify(html)+','+JSON.stringify(data)+');');
console.log('Worker build ready');

