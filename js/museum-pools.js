import { poolJson } from './candidate-pools.js';
import { canonicalLicense } from './license.js';
import { centuryLabel } from './interactions.js';
import { shortDescription } from './copy.js';

function present(record,format){
  const description=shortDescription([record.year,record.material,record.creator].filter(Boolean).join(' · '));
  let interaction=null;
  if(format.interaction){
    if(format.interaction==='caption')return null;
    const answer=format.id==='guess-century'?centuryLabel(record.begin):format.id==='guess-artist'?record.creator:
      format.id==='guess-material'?record.material:record.title;
    if(!answer)return null;
    interaction={type:format.id==='guess-crop'?'crop':'reveal',answer,details:description};
  }
  return {id:`${record.source}:${record.id}`,formatId:format.id,title:record.title,description,
    image:record.image,imageAlt:record.title,sourceId:record.source,sourceName:record.name,sourceItemUrl:record.url,
    facts:[],interaction,rights:{metadataLicense:record.metadataLicense === undefined ? 'CC0' : record.metadataLicense,mediaLicense:record.license,
      mediaLicenseUrl:record.licenseUrl,creator:record.creator || record.credit,attribution:record.credit,
      sourceItemUrl:record.url,commercialReuse:true,derivativesAllowed:true,verifiedBy:record.evidence,verifiedAt:new Date().toISOString()}};
}
export async function clevelandPool(query,format){
  const url='https://openaccess-api.clevelandart.org/api/artworks/?'+new URLSearchParams({q:query.term || 'art',cc0:'1',has_image:'1',limit:'30'});
  const data=await poolJson(url);
  return (data.data || []).filter(r=>r.share_license_status==='CC0' && r.images?.web?.url && r.title).map(r=>present({
    id:r.id,title:r.title,source:'cleveland',name:'Cleveland Museum of Art',image:r.images.web.url,
    url:r.url || `https://www.clevelandart.org/art/${r.accession_number}`,year:r.creation_date,begin:r.creation_date_earliest,
    material:r.technique,creator:r.creators?.map(c=>c.description).filter(Boolean).join('; '),
    license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',credit:'Cleveland Museum of Art · CC0',evidence:url,
  },format)).filter(Boolean);
}
export async function chicagoPool(query,format){
  const url='https://api.artic.edu/api/v1/artworks/search?'+new URLSearchParams({q:query.term || 'art',
    'query[term][is_public_domain]':'true',limit:'30',fields:'id,title,image_id,is_public_domain,artist_display,date_display,date_start,medium_display'});
  const data=await poolJson(url);
  return (data.data || []).filter(r=>r.is_public_domain===true && r.image_id && r.title).map(r=>present({
    id:r.id,title:r.title,source:'chicago',name:'Art Institute of Chicago',image:`https://www.artic.edu/iiif/2/${encodeURIComponent(r.image_id)}/full/600,/0/default.jpg`,
    url:`https://www.artic.edu/artworks/${r.id}`,year:r.date_display,begin:r.date_start,material:r.medium_display,creator:r.artist_display,
    license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',credit:'Art Institute of Chicago · CC0',evidence:url,
  },format)).filter(Boolean);
}
export async function wellcomePool(query,format){
  const url='https://api.wellcomecollection.org/catalogue/v2/images?'+new URLSearchParams({query:query.term || 'manuscript',pageSize:'20','locations.license':'cc0,pdm,cc-by,cc-by-sa'});
  const data=await poolJson(url);
  return (data.results || []).flatMap(r=>{
    const location=r.locations?.find(l=>canonicalLicense(l.license?.url) && /^https:\/\/iiif\.wellcomecollection\.org\/image\/.+\/info\.json$/.test(l.url));
    if(!location || !r.source?.id)return [];
    const license=canonicalLicense(location.license.url);
    // Original Foly caption: do not reuse uncertain catalogue prose or its license.
    const original=query.originalCaption===true;
    const record=present({id:r.id,title:original?`${format.title} · ${r.id}`:r.source.title,source:'wellcome',name:'Wellcome Collection',
      image:location.url.replace('/info.json','/full/600,/0/default.jpg'),url:`https://wellcomecollection.org/works/${r.source.id}`,
      license,metadataLicense:original?'CC0':canonicalLicense(r.metadataLicense),licenseUrl:location.license.url,credit:location.credit || 'Wellcome Collection',evidence:url,
    },format);
    if(record && original)record.description='Look closely at this openly licensed collection image. Explore the original record for its historical context.';
    return record?[record]:[];
  });
}