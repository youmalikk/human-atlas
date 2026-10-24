import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';

/** MedSchoolZone delivery lock.
 * The atlas is sold through medschoolzone.com and is only meant to run inside the
 * course page frame. A direct visit (link shared around, pages.dev URL, etc.) is
 * sent to the MedSchoolZone site instead. Local development is exempt.
 * The server-side companion is the Content-Security-Policy frame-ancestors header
 * in public/_headers, which stops other sites from framing the app at all.
 */
const LANDING='https://www.medschoolzone.com/';
const DEV_HOSTS=['localhost','127.0.0.1','[::1]'];
const framed=(()=>{try{return window.self!==window.top;}catch{return true;}})();
if(!framed&&!DEV_HOSTS.includes(location.hostname)){
 location.replace(LANDING);
}else{
 createRoot(document.getElementById('root')!).render(<Home/>);
}
