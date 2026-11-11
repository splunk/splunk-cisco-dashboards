import {useCallback,useEffect,useRef,useState} from 'react';
import timeParser from '../dashboardbuilder/custominput/timeparser';
type ParseResult={time?:string;iso?:string;error?:{message:string}};
export function useTimeParser() {
    const [parsed,setParsed]=useState<{earliest?:ParseResult;latest?:ParseResult}>({});
    const active=useRef(true);const versions=useRef({earliest:0,latest:0});
    useEffect(()=>{active.current=true;return()=>{active.current=false;versions.current.earliest++;versions.current.latest++;};},[]);
    const request=useCallback((key:'earliest'|'latest',time:string)=>{
        const id=++versions.current[key];
        void timeParser(time||'now','en_US').then((result:{time?:string;iso?:string;error?:{message?:unknown}|null})=>{
            if(active.current&&id===versions.current[key])setParsed(current=>({...current,[key]:{...result,error:result.error?{message:String(result.error.message??'Invalid time')}:undefined,time:result.time||time}}));
        }).catch(()=>{if(active.current&&id===versions.current[key])setParsed(current=>({...current,[key]:{time,error:{message:'Time could not be parsed'}}}));});
    },[]);
    return {parseEarliest:parsed.earliest,parseLatest:parsed.latest,handleRequestParseEarliest:useCallback((time:string)=>request('earliest',time),[request]),handleRequestParseLatest:useCallback((time:string)=>request('latest',time),[request])};
}
