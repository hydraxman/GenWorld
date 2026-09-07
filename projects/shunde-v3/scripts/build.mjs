import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
await fs.mkdir(path.join(root,'assets'),{recursive:true});
await fs.mkdir(path.join(root,'output'),{recursive:true});
await build({entryPoints:[path.join(root,'src/main.js')],bundle:true,format:'iife',target:'chrome120',outfile:path.join(root,'assets/scene.js'),logLevel:'info',plugins:[{name:'single-three-runtime',setup(b){b.onResolve({filter:/^three(?:\/|$)/},args=>({path:fileURLToPath(import.meta.resolve(args.path))}));}}]});
