from pathlib import Path
import subprocess,json,hashlib
r=Path(__file__).resolve().parent
prefix=r/'local-assets/courtyard/legacy-v4/庭院建筑_V4_真实叶片版.mp4'
tail=r/'output/ending-master.mp4';delivery_tail=r/'output/ending-delivery.mp4'
output=r/'output/庭院建筑_V6_正面近景分层版.mp4'
def run(args):return subprocess.run(args,check=True,capture_output=True,text=True).stdout
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(tail),'-an','-c:v','libx264','-preset','medium','-crf','22','-maxrate','5M','-bufsize','10M','-pix_fmt','yuv420p','-movflags','+faststart',str(delivery_tail)])
manifest=r/'qa/concat.txt';manifest.write_text(''.join("file '"+str(p)+"'\n" for p in [prefix,delivery_tail]))
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(manifest),'-map','0:v:0','-c','copy','-movflags','+faststart',str(output)])
run(['ffmpeg','-v','error','-xerror','-i',str(output),'-f','null','-'])
probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate,nb_read_frames','-of','json',str(output)]));v=probe['streams'][0]
assert v['width']==1920 and v['height']==1080 and v['r_frame_rate']=='30/1' and v['nb_read_frames']=='1380' and float(probe['format']['duration'])==46
hashes=[]
for p in [prefix,output]:
 text=run(['ffmpeg','-v','error','-i',str(p),'-map','0:v:0','-f','framemd5','-'])
 vals=[s.split(',')[-1].strip() for s in text.splitlines() if s and not s.startswith('#')];hashes.append(vals)
assert len(hashes[0])==1080 and hashes[0]==hashes[1][:1080], 'Prefix differs from delivered V4'
assert output.stat().st_size<30_000_000
result={'file':str(output),'probe':probe,'first_1080_decoded_frames_identical_to_V4':True,'added_frames':len(hashes[1])-len(hashes[0]),'complete_decode_passed':True,'sha256':hashlib.sha256(output.read_bytes()).hexdigest()};(r/'qa/final-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
run(['ffmpeg','-y','-hide_banner','-loglevel','error','-i',str(output),'-vf','select=eq(n\\,1080)+eq(n\\,1155)+eq(n\\,1215)+eq(n\\,1275)+eq(n\\,1365)','-vsync','0',str(r/'qa/final-%02d.png')])
