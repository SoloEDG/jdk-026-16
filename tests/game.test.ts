import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {puzzles} from '../src/features/catalog/model/puzzles';
import type {Mark,Puzzle} from '../src/shared/types';
import {clueSet,runs} from '../src/shared/clues';
import {newDocument} from '../src/shared/document';
import {transition} from '../src/app/reducer';
import {derivePlan,deriveLine,noteCurrent,HINT_LIMIT} from '../src/features/assist/model/guide';
import {lineStatuses} from '../src/features/board/lib/lineStatus';
import {loadDocument,saveDocument} from '../src/features/journal/lib/storage';
import {unlockedArt} from '../src/features/gallery/lib/artwork';
Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
let stored:string|null=null;
Object.defineProperty(globalThis,'localStorage',{value:{getItem:()=>stored,setItem:(_:string,value:string)=>{stored=value;}},configurable:true});
const cup=puzzles.find(p=>p.id==='cup')!;
test('clue runs include zero lines and separated groups',()=>{assert.deepEqual(runs([0,1,1,0,1]),[2,1]);assert.deepEqual(runs([0,0]),[0]);});
test('all built-in puzzles have valid dimensions and exactly one solution',()=>{
 for(const puzzle of puzzles){
  assert.equal(puzzle.solution.length,puzzle.size**2);
  const clues=clueSet(puzzle.size,puzzle.solution); const n=puzzle.size;
  const candidates=clues.map(clue=>Array.from({length:2**n},(_,mask)=>Array.from({length:n},(_,i)=>(mask>>i)&1)).filter(row=>JSON.stringify(runs(row))===JSON.stringify(clue)));
  let count=0;
  function search(rows:number[][],columns:number[][][]){
   if(count>1)return;
   const r=rows.length;if(r===n){count++;return;}
   for(const row of candidates[r]){const next=columns.map((patterns,c)=>patterns.filter(pattern=>pattern[r]===row[c]));if(next.every(p=>p.length))search([...rows,row],next);}
  }
  search([],candidates.slice(n)); console.log(puzzle.id, count); assert.equal(count,1,puzzle.id+' must be uniquely solvable');
 }
});
test('marks update line state, undo restores marks, another puzzle stays isolated',()=>{
 const p=puzzles[1];let d=newDocument(p); d=transition(d,{type:'mark',index:1,mark:'filled'},puzzles);assert.equal(d.sessions[p.id].marks[1],'filled');assert.equal(lineStatuses(p,d.sessions[p.id].marks)[0],false);
 d=transition(d,{type:'undo'},puzzles);assert.equal(d.sessions[p.id].marks[1],'unknown');d=transition(d,{type:'open',id:puzzles[0].id},puzzles);assert.equal(d.sessions[p.id].marks[1],'unknown');
});
test('guided cycle: three levels share one quota, re-viewing is free, undo cannot refund',()=>{
 let d=newDocument(cup);
 const first=derivePlan(cup,d.sessions[cup.id].marks).lines[0];
 assert.ok(first,'empty cup board has derivable lines');
 d=transition(d,{type:'guide.open'},puzzles);
 assert.equal(d.sessions[cup.id].hints,1);
 assert.equal(d.sessions[cup.id].guide?.level,1);
 assert.equal(d.sessions[cup.id].guide?.line,first.line);
 d=transition(d,{type:'guide.open'},puzzles);
 assert.equal(d.sessions[cup.id].hints,1,'re-opening the same level does not charge again');
 d=transition(d,{type:'guide.advance'},puzzles);
 assert.equal(d.sessions[cup.id].hints,2);
 assert.equal(d.sessions[cup.id].guide?.level,2);
 assert.equal(d.sessions[cup.id].notes.length,1,'shown reasons are kept as notes');
 d=transition(d,{type:'guide.advance'},puzzles);
 assert.equal(d.sessions[cup.id].hints,2,'viewing the confirm step is free');
 assert.equal(d.sessions[cup.id].guide?.level,3);
 const target=deriveLine(cup,d.sessions[cup.id].marks,first.line).certain[0];
 d=transition(d,{type:'guide.apply',index:target.index,mark:target.mark},puzzles);
 assert.equal(d.sessions[cup.id].hints,3,'the shared quota is fully spent by one full cycle');
 assert.equal(d.sessions[cup.id].marks[target.index],target.mark);
 assert.equal(d.sessions[cup.id].guide,null);
 d=transition(d,{type:'undo'},puzzles);
 assert.equal(d.sessions[cup.id].hints,3,'undo cannot refund consumed quota');
 d=transition(d,{type:'guide.open'},puzzles);
 assert.equal(d.sessions[cup.id].guide,null,'quota is exhausted');
});
test('apply re-proves the confirmed cell against the live board before placing',()=>{
 let d=newDocument(cup);
 d=transition(d,{type:'guide.open'},puzzles);
 d=transition(d,{type:'guide.advance'},puzzles);
 d=transition(d,{type:'guide.advance'},puzzles);
 const line=d.sessions[cup.id].guide!.line;
 const target=deriveLine(cup,d.sessions[cup.id].marks,line).certain[0];
 const spent=d.sessions[cup.id].hints;
 const wrong:Mark=target.mark==='filled'?'cross':'filled';
 d=transition(d,{type:'guide.apply',index:target.index,mark:wrong},puzzles);
 assert.equal(d.sessions[cup.id].marks[target.index],'unknown','a conclusion that was never derived is not placed');
 assert.equal(d.sessions[cup.id].hints,spent,'rejected apply does not charge');
 assert.equal(d.sessions[cup.id].guide?.stale,true);
 d=transition(d,{type:'mark',index:target.index,mark:wrong},puzzles);
 d=transition(d,{type:'guide.apply',index:target.index,mark:target.mark},puzzles);
 assert.equal(d.sessions[cup.id].hints,spent,'expired conclusion is not applied after the board changed');
 assert.equal(d.sessions[cup.id].guide?.stale,true);
});
test('reasons come from clues and marks only, never from the answer key',()=>{
 const a:Puzzle={id:'a',title:'',collection:'',level:'入门',size:2,solution:[1,0,0,1],color:'#000'};
 const b:Puzzle={id:'b',title:'',collection:'',level:'入门',size:2,solution:[0,1,1,0],color:'#000'};
 assert.deepEqual(clueSet(a.size,a.solution),clueSet(b.size,b.solution),'same clues, different solutions');
 const marks:Mark[]=['unknown','filled','unknown','unknown'];
 assert.deepEqual(derivePlan(a,marks),derivePlan(b,marks),'derivations depend only on clues and marks');
});
test('a board with no forced cell says so instead of faking a hint',()=>{
 const quiet:Puzzle={id:'quiet',title:'',collection:'',level:'入门',size:4,solution:[1,0,0,1,0,1,1,0,0,1,1,0,1,0,0,1],color:'#000'};
 let d=newDocument(quiet);
 assert.equal(derivePlan(quiet,d.sessions[quiet.id].marks).lines.length,0);
 d=transition(d,{type:'guide.open'},[quiet]);
 assert.equal(d.sessions[quiet.id].guide,null);
 assert.equal(d.sessions[quiet.id].hints,0,'no conclusion, no charge');
});
test('notes stay valid per line and expire only when their own line changes',()=>{
 let d=newDocument(cup);
 d=transition(d,{type:'guide.open'},puzzles);
 d=transition(d,{type:'guide.advance'},puzzles);
 const note=d.sessions[cup.id].notes[0];
 assert.ok(note);
 assert.equal(noteCurrent(cup,d.sessions[cup.id].marks,note),true);
 const otherCell=note.line===0?cup.size:0;
 d=transition(d,{type:'mark',index:otherCell,mark:'cross'},puzzles);
 assert.equal(noteCurrent(cup,d.sessions[cup.id].marks,note),true,'editing another line keeps the note valid');
 const ownCell=note.line<cup.size?note.line*cup.size:note.line-cup.size;
 d=transition(d,{type:'mark',index:ownCell,mark:'cross'},puzzles);
 assert.equal(noteCurrent(cup,d.sessions[cup.id].marks,note),false,'editing its own line expires the note');
});
test('solve commits a single record, unlocks art and freezes solved board',()=>{
 const p=puzzles[1];let d=newDocument(p);
 p.solution.forEach((v,index)=>{if(v)d=transition(d,{type:'mark',index,mark:'filled'},puzzles);});
 assert.equal(d.sessions[p.id].solved,true);assert.equal(d.records.length,1);assert.equal(unlockedArt(puzzles,d)[0].id,p.id);
 d=transition(d,{type:'mark',index:0,mark:'filled'},puzzles);assert.equal(d.records.length,1);assert.equal(d.sessions[p.id].marks[0],'unknown');
});
test('wrong filled and wrong crossed marks prevent solve',()=>{
 const p=puzzles[1];let d=newDocument(p);d=transition(d,{type:'mark',index:0,mark:'filled'},puzzles);
 p.solution.forEach((v,index)=>{if(v)d=transition(d,{type:'mark',index,mark:'filled'},puzzles);});assert.equal(d.records.length,0);
});
test('save and reopen retains progress, guide state and quota without another completion',()=>{
 stored=null;let d=newDocument(puzzles[0]);
 d=transition(d,{type:'guide.open'},puzzles);
 assert.equal(d.sessions[d.activeId].guide?.level,1);
 assert.ok(saveDocument(d));
 const restored=loadDocument(puzzles);
 assert.deepEqual(restored.document.sessions[d.activeId].marks,d.sessions[d.activeId].marks);
 assert.equal(restored.document.sessions[d.activeId].hints,1);
 assert.equal(restored.document.sessions[d.activeId].guide?.level,1,'refresh keeps the unlocked level');
 assert.equal(restored.warning,'');
 const again=transition(restored.document,{type:'guide.open'},puzzles);
 assert.equal(again.sessions[d.activeId].hints,1,'re-viewing after reload does not charge again');
});
test('old saves convert used hint counts into non-refillable remaining quota',()=>{
 const legacy=(hints:number)=>JSON.stringify({version:1,activeId:'cup',sessions:{cup:{puzzleId:'cup',marks:Array(25).fill('unknown'),moves:[],hints,checks:0,seconds:5,solved:false,updatedAt:1}},records:[]});
 stored=legacy(2);
 const restored=loadDocument(puzzles);
 assert.equal(restored.warning,'');
 assert.equal(restored.document.sessions['cup'].hints,2,'used count becomes consumed quota');
 assert.equal(restored.document.sessions['cup'].guide,null);
 assert.deepEqual(restored.document.sessions['cup'].notes,[]);
 let d=transition(restored.document,{type:'guide.open'},puzzles);
 assert.equal(d.sessions['cup'].hints,3,'only one unit of quota remained');
 assert.equal(d.sessions['cup'].guide?.level,1);
 d=transition(d,{type:'guide.advance'},puzzles);
 assert.equal(d.sessions['cup'].guide?.level,1,'no quota left for the next level');
 stored=legacy(3);
 const drained=loadDocument(puzzles);
 d=transition(drained.document,{type:'guide.open'},puzzles);
 assert.equal(d.sessions['cup'].guide,null,'a fully spent save gets nothing back');
});
test('malformed save returns recoverable warning without overwriting raw save',()=>{
 stored='{broken';const restored=loadDocument(puzzles);assert.ok(restored.warning);assert.equal(stored,'{broken');assert.equal(restored.document.activeId,puzzles[0].id);
});
