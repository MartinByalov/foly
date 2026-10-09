export const ALLOWED = new Set(['CC0','PDM','PUBLIC_DOMAIN','CC_BY','CC_BY_SA','US_GOV_PUBLIC_DOMAIN']);
export function canonicalLicense(value) {
  if(typeof value!=='string' || !value.trim())return null;
  const text=value.trim();
  if(ALLOWED.has(text))return text;
  if(/\bNC\b|\bND\b|noncommercial|no.?derivatives/i.test(text))return null;
  const names={'CC0':'CC0','PDM':'PDM','PUBLIC DOMAIN':'PUBLIC_DOMAIN','CC BY':'CC_BY','CC BY-SA':'CC_BY_SA'};
  const name=text.toUpperCase().replace(/\s+\d+(?:\.\d+)*$/,'');
  if(names[name])return names[name];
  try {
    const url=new URL(text);
    if(!['http:','https:'].includes(url.protocol) || url.hostname!=='creativecommons.org')return null;
    const match=url.pathname.match(/^\/(licenses\/(by|by-sa)|publicdomain\/(zero|mark))\/\d+\.\d+\/?$/);
    if(!match)return null;
    return match[2]==='by'?'CC_BY':match[2]==='by-sa'?'CC_BY_SA':match[3]==='zero'?'CC0':'PDM';
  }catch{return null;}
}
export function validateRights(rights, hasMedia=false) {
  if(!rights || !canonicalLicense(rights.metadataLicense))return {ok:false,reason:'unknown_license'};
  if(rights.commercialReuse!==true || rights.derivativesAllowed!==true)return {ok:false,reason:'bad_license'};
  const licenses=[canonicalLicense(rights.metadataLicense)];
  if(hasMedia){
    const media=canonicalLicense(rights.mediaLicense);
    if(!media)return {ok:false,reason:'unknown_license'};
    licenses.push(media);
  }
  if(!rights.sourceItemUrl || !rights.verifiedBy || !rights.verifiedAt)return {ok:false,reason:'missing_required_field'};
  if(licenses.some(license=>['CC_BY','CC_BY_SA'].includes(license)) &&
    (!rights.attribution || !rights.creator || (hasMedia && !rights.mediaLicenseUrl)))return {ok:false,reason:'no_attribution'};
  return {ok:true};
}