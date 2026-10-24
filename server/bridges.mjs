// Motor declarativo de quebra-cabeca: apenas as rotacoes das pontes mudam.
// O servidor valida as conexoes; o percurso nao e enviado antes da conclusao.
export const BRIDGE_PATHS = [
  [[0,0],[1,0],[2,0],[2,1],[2,2],[3,2],[3,3],[4,3],[4,4]],
  [[0,4],[0,3],[1,3],[1,2],[1,1],[2,1],[3,1],[3,0],[4,0]],
  [[0,0],[0,1],[0,2],[1,2],[2,2],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4]],
  [[0,4],[1,4],[2,4],[2,3],[2,2],[1,2],[1,1],[2,1],[3,1],[3,0],[4,0]],
];
const DIR={N:[0,-1],E:[1,0],S:[0,1],W:[-1,0]};
const ORDER=['N','E','S','W'];
function dir(a,b){return ORDER.find(k=>a[0]+DIR[k][0]===b[0]&&a[1]+DIR[k][1]===b[1]);}
function ports(kind,rot){let base=kind==='straight'?['N','S']:['N','E'];return base.map(k=>ORDER[(ORDER.indexOf(k)+rot)%4]).sort()}
function rotationFor(kind,expected){for(let i=0;i<4;i++)if(JSON.stringify(ports(kind,i))===JSON.stringify(expected.slice().sort()))return i;throw new Error('Caminho invalido')}
export function buildBridgeRound(number){
 const path=BRIDGE_PATHS[number%BRIDGE_PATHS.length];
 const tiles=[];
 for(let i=1;i<path.length-1;i++){
  const prev=dir(path[i],path[i-1]),next=dir(path[i],path[i+1]);
  const expected=[prev,next].sort();
  const kind=(ORDER.indexOf(prev)+2)%4===ORDER.indexOf(next)?'straight':'corner';
  const solution=rotationFor(kind,expected);
  const extra=((i*3+number*7)%3)+1; // scramble. All stages remain solvable.
  tiles.push({id:`${path[i][0]}_${path[i][1]}`,x:path[i][0],y:path[i][1],kind,rot:(solution+extra)%4,solution});
 }
 return {title:['A Ponte das Estrelas','Ilhas da Descoberta','Caminho da Floresta','O Segredo do Rio'][number%4],hint:'Toque numa ponte e gire. As extremidades devem ligar os caminhos sem pontas soltas.',grid:5,start:path[0],goal:path.at(-1),path,tiles};
}
export function publicBridgeRound(round){const {path,tiles,...other}=round;return {...other,tiles:tiles.map(({solution,...t})=>t)}}
export function validateBridgeRound(round,rotations){if(!rotations||typeof rotations!=='object'||Array.isArray(rotations))return false;
 for(const t of round.tiles){const rot=rotations[t.id];if(!Number.isInteger(rot)||rot<0||rot>3)return false;
  if(JSON.stringify(ports(t.kind,rot))!==JSON.stringify(ports(t.kind,t.solution)))return false;
 }
 return true;
}

/** Simulate travel up to the first disconnected edge, without revealing the solution. */
export function traceBridgeRound(round,rotations){
 const tiles=new Map(round.tiles.map(t=>[t.id,t]));
 const path=[round.start];
 for(let i=0;i<round.path.length-1;i++){
  const a=round.path[i],b=round.path[i+1];
  const direct=dir(a,b),back=dir(b,a);
  const ta=tiles.get(a.join('_')),tb=tiles.get(b.join('_'));
  const aOK=!ta||(Number.isInteger(rotations?.[ta.id])&&ports(ta.kind,rotations[ta.id]).includes(direct));
  const bOK=!tb||(Number.isInteger(rotations?.[tb.id])&&ports(tb.kind,rotations[tb.id]).includes(back));
  if(!aOK||!bOK)return {walkPath:path,fallAt:b,completed:false};
  path.push(b);
 }
 return {walkPath:path,fallAt:null,completed:true};
}
