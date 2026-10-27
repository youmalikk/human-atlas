/** 3D organ views: content, structure groups and shading for each organ model in public/organs.
 * Structure groups match the cleaned node names written by scripts/build-organs.mjs (first match wins).
 * Facts are general educational context for medical students, not clinical guidance.
 */
export type OrganId='heart'|'brain'|'lungs'|'liver'|'pancreas'|'small-intestine'|'large-intestine'|'kidney'|'eye'|'skin';
export interface OrganGroup {
 id:string;label:string;match:RegExp;color:string;
 description?:string;
 /** Node used to anchor the group's pin; when omitted the group has no pin. */
 pin?:RegExp;
 opacity?:number;
 /** Not drawn and not listed (overlapping helper surfaces). */
 hidden?:boolean;
}
export interface OrganInside {label:string;offLabel:string;mode:'clip'|'hide';
 /** clip: keep the side where dot(normal, p) + constant >= 0 (organ space, unit-cube scale). */
 normal?:[number,number,number];constant?:number;
 /** hide: groups hidden while the inside view is on. */
 hide?:string[];
 /** hide: groups only shown while the inside view is on. */
 show?:string[];
 view?:{az:number;el:number};
}
export interface OrganDef {
 id:OrganId;name:string;latin:string;summary:string;
 facts:{label:string;value:string}[];note:string;
 view:{az:number;el:number};
 inside?:OrganInside;
 /** Explode strength (1 = standard full separation). */
 explode:number;
 /** Enclosing surfaces that fade away as the organ explodes, so the inside is revealed. */
 shells?:string[];
 /** Groups normally hidden that appear once the organ starts exploding (e.g. liver segments under the capsule). */
 explodeReveal?:string[];
 /** Credit line for the model shown in the fact card. */
 source:string;
 groups:OrganGroup[];
}

export const ORGANS:OrganDef[]=[
 {id:'heart',name:'Heart',latin:'Cor',summary:'A four-chambered muscular pump that drives blood through the lungs and the rest of the body.',
  facts:[{label:'Function',value:'Pumps blood to the lungs (right side) and the body (left side)'},{label:'Location',value:'Middle mediastinum, about two-thirds left of the midline'},{label:'Size',value:'About a closed fist, roughly 12 × 8.5 × 6 cm'},{label:'Weight',value:'About 250–350 g'},{label:'Blood supply',value:'Right and left coronary arteries'},{label:'Tissue',value:'Cardiac muscle (myocardium)'}],
  note:'At rest the heart moves about 5 litres of blood a minute. The LAD (anterior interventricular branch) is the coronary artery most often blocked in myocardial infarction.',
  view:{az:18,el:8},explode:1,source:'Model: BodyParts3D, The Database Center for Life Science (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Open the heart',offLabel:'Close the heart',mode:'clip',normal:[0,0,-1],constant:.02,view:{az:0,el:6}},
  groups:[
   {id:'cardiac-veins',label:'Cardiac veins and coronary sinus',match:/cardiac vein|interventricular vein|marginal vein|vein of left ventricle|coronary sinus/i,color:'#3c4c86',description:'Drain the heart muscle into the coronary sinus, which empties into the right atrium.'},
   {id:'coronary-arteries',label:'Coronary arteries',match:/coronary artery|interventricular branch|interventricular artery|conus|marginal branch|ventricular branch|diagonal branch|circumflex|anterior branch of anterior/i,color:'#cf2a22',description:'The right and left coronary arteries leave the aortic sinuses and supply the myocardium. The LAD supplies the anterior wall and the anterior two-thirds of the septum.',pin:/^trunk of anterior interventricular branch/i},
   {id:'aorta',label:'Aorta and arch branches',match:/aorta|brachiocephalic artery|left subclavian artery|left common carotid artery/i,color:'#c3352d',description:'Carries oxygenated blood from the left ventricle to the body. The arch gives off the brachiocephalic trunk, the left common carotid and the left subclavian arteries.',pin:/^arch of aorta$/i},
   {id:'pulmonary-arteries',label:'Pulmonary trunk and arteries',match:/pulmonary trunk|pulmonary artery/i,color:'#5868ab',description:'Carry deoxygenated blood from the right ventricle to the lungs: the only arteries after birth that carry deoxygenated blood.',pin:/^pulmonary trunk$/i},
   {id:'venae-cavae',label:'Venae cavae',match:/vena cava/i,color:'#46568f',description:'The superior and inferior venae cavae return deoxygenated blood from the upper and lower body to the right atrium.',pin:/^superior vena cava$/i},
   {id:'pulmonary-veins',label:'Pulmonary veins',match:/pulmonary vein/i,color:'#b6372f',description:'Usually four veins that bring oxygenated blood from the lungs to the left atrium.'},
   {id:'valves',label:'Heart valves',match:/valve|leaflet|cusp/i,color:'#f0d7c6',description:'The mitral and tricuspid (atrioventricular) valves and the aortic and pulmonary (semilunar) valves keep blood moving one way. S1 is AV valve closure; S2 is semilunar valve closure.',pin:/^anterior leaflet of mitral valve$/i},
   {id:'papillary',label:'Papillary muscles',match:/papillary/i,color:'#8a2a25',description:'Anchor the atrioventricular valve cusps through the chordae tendineae and stop them prolapsing during systole.'},
   {id:'atria',label:'Atria',match:/wall of (left|right) atrium/i,color:'#ab3b33',description:'Thin-walled receiving chambers. The right atrium collects blood from the venae cavae and coronary sinus; the left atrium receives the pulmonary veins.',pin:/^wall of right atrium$/i},
   {id:'ventricles',label:'Ventricles',match:/wall of ventricle/i,color:'#992e28',description:'The pumping chambers. The left ventricular wall is about three times thicker than the right because it pumps against systemic pressure.',pin:/^wall of ventricle$/i},
  ]},
 {id:'brain',name:'Brain',latin:'Encephalon',summary:'The control centre of the nervous system: cerebrum, cerebellum and brainstem.',
  facts:[{label:'Function',value:'Sensation, movement, thought, memory, emotion and body regulation'},{label:'Location',value:'Cranial cavity'},{label:'Weight',value:'About 1.3–1.4 kg in adults'},{label:'Blood supply',value:'Internal carotid and vertebral arteries, joined by the circle of Willis'},{label:'Tissue',value:'Grey matter (neuron cell bodies) over white matter (myelinated axons)'}],
  note:'The brain is about 2% of body weight but uses about 20% of the body’s oxygen at rest. The middle cerebral artery is the vessel most often involved in stroke.',
  view:{az:62,el:12},explode:1,shells:['white-matter'],source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Midline section',offLabel:'Whole brain',mode:'clip',normal:[1,0,0],constant:.02,view:{az:-90,el:6}},
  groups:[
   {id:'ventricles',label:'Ventricles',match:/ventricle|aqueduct|central canal/i,color:'#86b9d6',description:'CSF flows from the lateral ventricles to the third ventricle, the cerebral aqueduct and the fourth ventricle. A blockage causes hydrocephalus.',pin:/^body of lateral ventricle \(left\)$/i},
   {id:'commissures',label:'Corpus callosum and commissures',match:/corpus callosum|commissure|fornix|mammillothalamic|optic radiation/i,color:'#f3e8db',description:'The corpus callosum links the two hemispheres; the fornix carries hippocampal output to the mammillary bodies; the optic radiation runs to the visual cortex.',pin:/^corpus callosum \(left\)$/i},
   {id:'white-matter',label:'Cerebral white matter',match:/^white matter of/i,color:'#efe3d4',description:'Myelinated axons beneath the cortex: projection, association and commissural fibres that connect brain regions.'},
   {id:'diencephalon',label:'Thalamus and hypothalamus',match:/thalam|geniculate|pulvinar|habenul|pineal|zona incerta|hypothalamus|subthalamic|optic tract|optic chiasm|midline nuclear|ventral posterior/i,color:'#d3998a',description:'The thalamus relays sensory information to the cortex (every sense except smell). The hypothalamus controls the pituitary, temperature, hunger, thirst and circadian rhythm.',pin:/^thalamus \(left\)$/i},
   {id:'basal-ganglia',label:'Basal ganglia',match:/caudate|putamen|globus pallidus|accumbens|claustrum|basal forebrain|septal|bed nucleus/i,color:'#c98f80',description:'The caudate, putamen and globus pallidus help start and scale movement. Loss of their dopamine input from the substantia nigra causes Parkinson’s disease.',pin:/^head of caudate \(left\)$/i},
   {id:'limbic',label:'Hippocampus and amygdala',match:/hippocamp|amygdal|^(central nuclear group|lateral nucleus|basolateral nucleus|basomedial nucleus|anterior cortical nucleus|posterior cortical nucleus|medial nucleus) \(|olfactory|piriform|gyrus ambiens|perirhinal/i,color:'#d39c8c',description:'The hippocampus forms new memories and is affected early in Alzheimer’s disease; the amygdala processes fear and emotion.',pin:/^body of hippocampus \(left\)$/i},
   {id:'cerebellum',label:'Cerebellum',match:/cerebell|vermis/i,color:'#cf9585',description:'Coordinates movement, balance and motor learning. A cerebellar lesion causes ataxia and intention tremor on the same side.',pin:/^lateral hemisphere of cerebellum \(left\)$/i},
   {id:'brainstem',label:'Brainstem',match:/pons|pontine|medulla|midbrain|tegmentum|colliculus|olive|substantia nigra|red nucleus|cerebral peduncle|pretectal/i,color:'#d8ae98',description:'Midbrain, pons and medulla: relay pathways, cranial nerve nuclei III–XII and the centres that control breathing and heart rate.',pin:/^basilar part of pons \(left\)$/i},
   {id:'insula-cingulate',label:'Insula and cingulate gyrus',match:/insul|cingul|paracingulate|subcallosal/i,color:'#dba697',description:'The insula handles taste, interoception and emotion; the cingulate gyrus links emotion, attention and behaviour (limbic system).'},
   {id:'frontal',label:'Frontal lobe',match:/frontal|precentral|orbital gyrus|gyrus rectus|paracentral lobule rostral|rostral gyrus|frontomarginal/i,color:'#e0ab9c',description:'Planning, judgement, personality and voluntary movement (primary motor cortex in the precentral gyrus). Broca’s area sits in the dominant inferior frontal gyrus.',pin:/^superior frontal gyrus \(left\)$/i},
   {id:'parietal',label:'Parietal lobe',match:/postcentral|parietal|supramarginal|angular|precuneus|paracentral lobule caudal/i,color:'#dca99c',description:'Body sensation (primary somatosensory cortex in the postcentral gyrus), spatial awareness and attention. Damage to the non-dominant side can cause neglect.',pin:/^supramarginal gyrus \(left\)$/i},
   {id:'occipital',label:'Occipital lobe',match:/occipital|cuneus|lingual/i,color:'#d9a69a',description:'Vision. The primary visual cortex lines the calcarine sulcus on the medial surface.',pin:/^superior occipital gyrus \(left\)$/i},
   {id:'temporal',label:'Temporal lobe',match:/temporal|planum|heschl|fusiform gyrus temporal/i,color:'#e2b0a0',description:'Hearing (Heschl’s gyrus), language comprehension (Wernicke’s area in the dominant superior temporal gyrus) and memory.',pin:/^middle temporal gyrus \(left\)$/i},
  ]},
 {id:'lungs',name:'Lungs',latin:'Pulmones',summary:'Paired organs of gas exchange, divided into lobes and bronchopulmonary segments.',
  facts:[{label:'Function',value:'Gas exchange: oxygen into the blood, carbon dioxide out'},{label:'Location',value:'Thoracic cavity, each lung in its own pleural cavity'},{label:'Lobes',value:'Right 3 lobes (10 segments) · Left 2 lobes (8–10 segments)'},{label:'Alveolar surface',value:'About 70 m² across roughly 300–500 million alveoli'},{label:'Blood supply',value:'Pulmonary arteries for gas exchange; bronchial arteries nourish the lung tissue'},{label:'Tissue',value:'Branching bronchial tree ending in alveoli lined by type I and II pneumocytes'}],
  note:'Inhaled foreign bodies usually enter the right main bronchus because it is wider, shorter and more vertical than the left.',
  view:{az:0,el:4},explode:1,source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Show the airways',offLabel:'Show the lobes',mode:'hide',hide:['right-upper','right-middle','right-lower','left-upper','lingula','left-lower']},
  groups:[
   {id:'airways',label:'Trachea and bronchial tree',match:/bronchus$|bronchi$|trachea|cartilage/i,color:'#ead8c4',description:'Trachea → main bronchi → lobar bronchi → segmental bronchi. C-shaped cartilage keeps the larger airways open.',pin:/^trachea and main bronchi$/i},
   {id:'hilum',label:'Hilum',match:/hilum/i,color:'#b26a68',description:'Where the main bronchus, pulmonary artery and veins, bronchial vessels, nerves and lymphatics enter and leave the lung.'},
   {id:'right-upper',label:'Right upper lobe',match:/^right (apical|posterior|anterior) bronchopulmonary segment$/i,color:'#d88b8a',description:'Apical, posterior and anterior segments. The upper lobes are the classic site of reactivated tuberculosis.',pin:/^right anterior bronchopulmonary segment$/i},
   {id:'right-middle',label:'Right middle lobe',match:/^right (lateral|medial) bronchopulmonary segment$/i,color:'#e3a29d',description:'Lateral and medial segments, separated from the upper lobe by the horizontal fissure. Best heard over the anterior chest.',pin:/^right lateral bronchopulmonary segment$/i},
   {id:'right-lower',label:'Right lower lobe',match:/^right (superior|.* basal) bronchopulmonary segment$/i,color:'#cd8180',description:'Superior and four basal segments. The commonest site of aspiration: posterior basal segment when upright, superior segment when lying down.',pin:/^right anterior basal bronchopulmonary segment$/i},
   {id:'left-upper',label:'Left upper lobe',match:/^left (apical|posterior|anterior) bronchopulmonary segment$/i,color:'#d88b8a',description:'Apicoposterior and anterior segments, separated from the lower lobe by the oblique fissure.',pin:/^left anterior bronchopulmonary segment$/i},
   {id:'lingula',label:'Lingula',match:/lingula/i,color:'#e3a29d',description:'Superior and inferior lingular segments of the left upper lobe: the left lung’s counterpart of the right middle lobe.',pin:/^left lingula inferior bronchopulmonary segment$/i},
   {id:'left-lower',label:'Left lower lobe',match:/^left (superior|.* basal) bronchopulmonary segment$/i,color:'#cd8180',description:'Superior and basal segments, lying mostly posteriorly.',pin:/^left lateral basal bronchopulmonary segment$/i},
  ]},
 {id:'liver',name:'Liver',latin:'Hepar',summary:'The largest internal organ: metabolism, bile, plasma proteins and detoxification.',
  facts:[{label:'Function',value:'Metabolism, bile production, albumin and clotting factor synthesis, detoxification, glycogen storage'},{label:'Location',value:'Right upper quadrant, under the diaphragm'},{label:'Weight',value:'About 1.4–1.6 kg'},{label:'Blood supply',value:'Portal vein (about 75%) and hepatic artery proper (about 25%)'},{label:'Tissue',value:'Hepatocytes arranged in lobules around central veins'}],
  note:'The 8 Couinaud segments each have their own portal triad and venous drainage, so a surgeon can remove one segment without the others.',
  view:{az:0,el:14},explode:1,shells:['capsule'],explodeReveal:['segment-1','segment-2','segment-3','segment-4','segment-5','segment-6','segment-7','segment-8'],source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Show the 8 segments',offLabel:'Show the surface',mode:'hide',hide:['capsule'],show:['segment-1','segment-2','segment-3','segment-4','segment-5','segment-6','segment-7','segment-8']},
  groups:[
   {id:'capsule',label:'Liver surface (Glisson’s capsule)',match:/^liver capsule$/i,color:'#7b2620',description:'A thin fibrous capsule covering the liver. Stretching of the capsule is why liver swelling causes right upper quadrant pain.'},
   {id:'surface-patches',label:'Surface areas',match:/impression|diaphragmatic surface|bare area|porta hepatis/i,color:'#7b2620',hidden:true},
   {id:'segment-1',label:'Segment I (caudate lobe)',match:/^caudate lobe of liver$/i,color:'#8e4a7a',description:'Drains directly into the inferior vena cava, so it is often spared and enlarged in Budd–Chiari syndrome.',pin:/^caudate lobe of liver$/i},
   {id:'segment-2',label:'Segment II (left posterolateral)',match:/^left posterolateral segment$/i,color:'#c0643f',description:'Upper part of the left lateral section.',pin:/^left posterolateral segment$/i},
   {id:'segment-3',label:'Segment III (left anterolateral)',match:/^left anterolateral segment$/i,color:'#d29a4c',description:'Lower part of the left lateral section; with segment II it is the graft used in many paediatric transplants.',pin:/^left anterolateral segment$/i},
   {id:'segment-4',label:'Segment IV (left medial, incl. quadrate lobe)',match:/^left (superomedial|inferomedial) segment$|quadrate lobe/i,color:'#c86a7a',description:'Left medial section between the falciform ligament and the gallbladder–IVC line (Cantlie’s line); IVb includes the quadrate lobe.',pin:/^left inferomedial segment$/i},
   {id:'segment-5',label:'Segment V (right anteroinferior)',match:/^right anteroinferior segment$/i,color:'#6f8f5a',description:'Lies next to the gallbladder bed.',pin:/^right anteroinferior segment$/i},
   {id:'segment-6',label:'Segment VI (right posteroinferior)',match:/^right posteroinferior segment$/i,color:'#4f8a8b',description:'Lower part of the right posterior section, next to the right kidney.'},
   {id:'segment-7',label:'Segment VII (right posterosuperior)',match:/^right posterosuperior segment$/i,color:'#5b6fa8',description:'Upper part of the right posterior section, under the diaphragm.'},
   {id:'segment-8',label:'Segment VIII (right anterosuperior)',match:/^right anterosuperior segment$/i,color:'#9a5aa0',description:'Upper part of the right anterior section, directly under the diaphragm.',pin:/^right anterosuperior segment$/i},
   {id:'falciform',label:'Falciform and round ligaments',match:/falciform|round ligament/i,color:'#efe0cb',description:'The falciform ligament attaches the liver to the anterior abdominal wall; its free edge carries the round ligament, the remnant of the umbilical vein.',pin:/^falciform ligament$/i},
   {id:'ligaments',label:'Other ligaments',match:/ligament|ligamentum/i,color:'#e8d6c0',description:'The coronary and triangular ligaments fix the liver to the diaphragm; the ligamentum venosum is the remnant of the ductus venosus; the hepatoduodenal ligament carries the portal triad.'},
  ]},
 {id:'pancreas',name:'Pancreas',latin:'Pancreas',summary:'A retroperitoneal gland with exocrine (digestive) and endocrine (hormonal) roles.',
  facts:[{label:'Function',value:'Exocrine: digestive enzymes and bicarbonate · Endocrine: insulin, glucagon, somatostatin'},{label:'Location',value:'Retroperitoneal, behind the stomach, across L1–L2'},{label:'Length',value:'About 12–15 cm'},{label:'Weight',value:'About 70–100 g'},{label:'Blood supply',value:'Pancreaticoduodenal arteries (head) and splenic artery branches (body and tail)'},{label:'Tissue',value:'Exocrine acini (about 98%) and islets of Langerhans (about 1–2%)'}],
  note:'Cancer of the pancreatic head can block the common bile duct, giving painless jaundice with a palpable gallbladder (Courvoisier’s sign).',
  view:{az:0,el:24},explode:1,source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  groups:[
   {id:'head',label:'Head',match:/^head of pancreas$/i,color:'#e2bf8e',description:'Sits in the C-loop of the duodenum, with the common bile duct running behind or through it.',pin:/^head of pancreas$/i},
   {id:'uncinate',label:'Uncinate process',match:/uncinate/i,color:'#d8b282',description:'Hooks behind the superior mesenteric vessels.',pin:/uncinate/i},
   {id:'neck',label:'Neck',match:/^neck of pancreas$/i,color:'#e8c899',description:'Lies in front of the confluence of the superior mesenteric and splenic veins (forming the portal vein).',pin:/^neck of pancreas$/i},
   {id:'body',label:'Body',match:/^body of pancreas$/i,color:'#dfbb8a',description:'Crosses the aorta and the left kidney behind the stomach.',pin:/^body of pancreas$/i},
   {id:'tail',label:'Tail',match:/^tail of pancreas$/i,color:'#d6ae7f',description:'Reaches the splenic hilum in the splenorenal ligament; it has the highest density of islets.',pin:/^tail of pancreas$/i},
  ]},
 {id:'small-intestine',name:'Small intestine',latin:'Intestinum tenue',summary:'Duodenum, jejunum and ileum: where most digestion and absorption happens.',
  facts:[{label:'Function',value:'Digestion and absorption of nutrients'},{label:'Location',value:'Central and lower abdomen; the duodenum curves around the pancreatic head'},{label:'Length',value:'About 6 m: duodenum about 25 cm, then jejunum (two-fifths) and ileum (three-fifths)'},{label:'Blood supply',value:'Superior mesenteric artery, plus coeliac branches to the upper duodenum'},{label:'Tissue',value:'Mucosa folded into villi and microvilli; Peyer’s patches in the ileum'}],
  note:'Iron is absorbed mainly in the duodenum; vitamin B12 and bile salts in the terminal ileum.',
  view:{az:0,el:6},explode:.9,source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  groups:[
   {id:'duodenum',label:'Duodenum',match:/^duodenum /i,color:'#d99a80',description:'C-shaped first part in four sections: superior (D1, commonest site of peptic ulcer), descending (D2, receives bile and pancreatic juice), horizontal (D3, crosses between the aorta and SMA) and ascending (D4).',pin:/^duodenum descending$/i},
   {id:'ampulla',label:'Ampulla and duodenal papillae',match:/ampulla|papilla/i,color:'#c3735f',description:'The common bile duct and main pancreatic duct meet at the hepatopancreatic ampulla, controlled by the sphincter of Oddi. The minor papilla drains the accessory duct (of Santorini).',pin:/^duodenal ampulla$/i},
   {id:'jejunum',label:'Jejunum',match:/^jejunum$/i,color:'#e5a49b',description:'Wider and thicker-walled than the ileum, with long vasa recta and prominent circular folds. Most nutrients are absorbed here.',pin:/^jejunum$/i},
   {id:'terminal-ileum',label:'Terminal ileum',match:/^ileum terminal$/i,color:'#d88f88',description:'Absorbs vitamin B12 (bound to intrinsic factor) and bile salts; the typical site of Crohn’s disease.',pin:/^ileum terminal$/i},
   {id:'ileum',label:'Ileum',match:/^ileum$/i,color:'#e09d96',description:'Thinner wall, more arterial arcades with short vasa recta, and lymphoid Peyer’s patches.',pin:/^ileum$/i},
  ]},
 {id:'large-intestine',name:'Large intestine',latin:'Intestinum crassum',summary:'Caecum, appendix, colon and rectum: water absorption and stool formation.',
  facts:[{label:'Function',value:'Absorbs water and electrolytes; forms and stores faeces'},{label:'Location',value:'Frames the abdomen from the right iliac fossa to the pelvis'},{label:'Length',value:'About 1.5 m'},{label:'Blood supply',value:'Superior mesenteric artery (to about two-thirds of the transverse colon), then inferior mesenteric artery'},{label:'Tissue',value:'Crypts rich in goblet cells, no villi; taeniae coli and haustra'}],
  note:'The splenic flexure is a watershed between the SMA and IMA territories, so it is especially vulnerable to ischaemic colitis.',
  view:{az:0,el:6},explode:.85,source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  groups:[
   {id:'caecum',label:'Caecum',match:/caecum/i,color:'#d99682',description:'A blind pouch in the right iliac fossa where the ileum enters the colon.',pin:/caecum/i},
   {id:'appendix',label:'Vermiform appendix',match:/appendix/i,color:'#cf8673',description:'Its base lies at McBurney’s point, one-third of the way from the ASIS to the umbilicus. Appendicitis pain classically starts around the umbilicus and moves to the right iliac fossa.',pin:/appendix/i},
   {id:'ileocecal',label:'Ileocaecal valve',match:/ileocecal/i,color:'#c47a68',description:'Limits backflow of colonic contents into the ileum.'},
   {id:'ascending',label:'Ascending colon',match:/ascending colon/i,color:'#dc9b86',description:'Retroperitoneal; supplied by the ileocolic and right colic arteries (SMA).',pin:/ascending colon/i},
   {id:'hepatic-flexure',label:'Hepatic flexure',match:/hepatic flexure/i,color:'#d6927e',description:'Right colic flexure, where the colon turns under the liver.'},
   {id:'transverse',label:'Transverse colon',match:/transverse colon/i,color:'#e0a28c',description:'Intraperitoneal, hanging on the transverse mesocolon; supplied by the middle colic artery.',pin:/transverse colon/i},
   {id:'splenic-flexure',label:'Splenic flexure',match:/splenic flexure/i,color:'#d6927e',description:'Left colic flexure near the spleen, sitting higher than the hepatic flexure.'},
   {id:'descending',label:'Descending colon',match:/descending colon/i,color:'#dc9b86',description:'Retroperitoneal; supplied by the left colic artery (IMA).',pin:/descending colon/i},
   {id:'sigmoid',label:'Sigmoid colon',match:/sigmoid/i,color:'#d4917d',description:'S-shaped and mobile on its mesocolon; a common site of diverticular disease and volvulus.',pin:/sigmoid/i},
   {id:'rectum',label:'Rectum',match:/rectum/i,color:'#c98471',description:'Stores faeces before defecation; it has no taeniae coli.',pin:/rectum/i},
  ]},
 {id:'kidney',name:'Kidney',latin:'Ren',summary:'The left kidney: cortex, medulla and the structures of its hilum.',
  facts:[{label:'Function',value:'Filters blood; balances fluid, electrolytes, acid–base and blood pressure; makes erythropoietin and activates vitamin D'},{label:'Location',value:'Retroperitoneal at T12–L3; the right kidney sits slightly lower'},{label:'Size',value:'About 11 × 6 × 3 cm'},{label:'Weight',value:'About 120–170 g'},{label:'Blood supply',value:'Renal artery from the abdominal aorta; the kidneys receive about 20% of cardiac output'},{label:'Tissue',value:'About 1 million nephrons per kidney in the cortex and medulla'}],
  note:'At the hilum the order from front to back is vein, artery, pelvis. Together the kidneys filter about 180 litres of plasma a day.',
  view:{az:28,el:6},explode:1,shells:['capsule','cortex','columns'],source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Show the medulla',offLabel:'Show the surface',mode:'hide',hide:['capsule','cortex','columns']},
  groups:[
   {id:'capsule',label:'Renal capsule',match:/kidney capsule/i,color:'#8f3c33',description:'A tough fibrous layer that wraps and protects the kidney.',pin:/kidney capsule/i},
   {id:'cortex',label:'Renal cortex',match:/cortex/i,color:'#b8584b',description:'Holds the glomeruli and convoluted tubules, where blood is filtered.'},
   {id:'columns',label:'Renal columns',match:/renal column/i,color:'#b45a4e',description:'Bands of cortex between the pyramids that carry the interlobar vessels.',pin:/renal column/i},
   {id:'pyramids',label:'Renal pyramids (medulla)',match:/renal pyramid/i,color:'#8d3536',description:'Contain the loops of Henle and collecting ducts that concentrate urine.',pin:/renal pyramid/i},
   {id:'papillae',label:'Renal papillae',match:/renal papilla/i,color:'#c98c7f',description:'Pyramid tips that drain urine into the minor calyces. Papillary necrosis can follow analgesic overuse, sickle cell disease or diabetes.',pin:/renal papilla/i},
   {id:'hilum',label:'Hilum',match:/hilum/i,color:'#dcbc9f',description:'Medial notch where the renal vein, artery and pelvis enter and leave (front to back: vein, artery, pelvis).',pin:/hilum/i},
  ]},
 {id:'eye',name:'Eye',latin:'Bulbus oculi',summary:'The left eyeball: its three coats, the lens and the optical media.',
  facts:[{label:'Function',value:'Focuses light on the retina and turns it into nerve signals'},{label:'Location',value:'Orbit, protected by the eyelids'},{label:'Size',value:'About 24 mm in diameter'},{label:'Weight',value:'About 7.5 g'},{label:'Blood supply',value:'Ophthalmic artery (from the internal carotid) via the central retinal and ciliary arteries'},{label:'Tissue',value:'Fibrous coat (sclera, cornea), vascular coat (choroid, ciliary body, iris), neural coat (retina)'}],
  note:'The optic disc has no photoreceptors, so it forms the blind spot. Blocked drainage of aqueous humor raises eye pressure and causes glaucoma.',
  view:{az:38,el:8},explode:1,shells:['sclera','choroid','conjunctiva','vitreous','aqueous'],source:'Model: Human Reference Atlas 3D library, HuBMAP Consortium (CC BY 4.0), simplified and recoloured for study.',
  inside:{label:'Cut the eye open',offLabel:'Close the eye',mode:'clip',normal:[-1,0,0],constant:.02,view:{az:90,el:4}},
  groups:[
   {id:'cornea',label:'Cornea',match:/^cornea$/i,color:'#cfe4ef',opacity:.22,description:'The clear, avascular front window that provides about two-thirds of the eye’s focusing power.',pin:/^cornea$/i},
   {id:'conjunctiva',label:'Conjunctiva',match:/conjunctiva/i,color:'#f1d7cf',opacity:.18,description:'Thin mucous membrane covering the sclera and lining the eyelids.'},
   {id:'aqueous',label:'Aqueous humor',match:/aqueous/i,color:'#dcebf2',opacity:.1,description:'Fluid in the anterior and posterior chambers that nourishes the lens and cornea.'},
   {id:'vitreous',label:'Vitreous body',match:/vitreous/i,color:'#e4eef2',opacity:.08,description:'Clear gel filling the posterior four-fifths of the eye.'},
   {id:'iris',label:'Iris and pupil',match:/^iris$|^pupil$/i,color:'#5a3d29',description:'The sphincter pupillae (parasympathetic, CN III) narrows the pupil; the dilator pupillae (sympathetic) widens it.',pin:/^iris$/i},
   {id:'lens',label:'Lens and zonules',match:/^lens$|suspensory ligament/i,color:'#eadfbf',opacity:.75,description:'The lens thickens for near vision when the ciliary muscle contracts (accommodation). Clouding of the lens is a cataract.',pin:/^lens$/i},
   {id:'ciliary',label:'Ciliary body',match:/ciliary/i,color:'#7a3b2f',description:'Ciliary processes secrete aqueous humor; the ciliary muscle controls accommodation.',pin:/^ciliary body$/i},
   {id:'drainage',label:'Trabecular meshwork and Schlemm’s canal',match:/trabecular|schlemm/i,color:'#9fb6cb',description:'Drain aqueous humor from the anterior chamber angle. Blocked outflow raises pressure in glaucoma.'},
   {id:'macula',label:'Macula and fovea',match:/macula|fovea/i,color:'#b8892d',description:'Central retina for sharp, detailed vision; the fovea contains only cones.',pin:/macula/i},
   {id:'optic-disc',label:'Optic disc',match:/optic disc/i,color:'#f0d4a2',description:'Where the optic nerve leaves the eye: no photoreceptors, hence the blind spot. It swells (papilloedema) with raised intracranial pressure.',pin:/optic disc/i},
   {id:'retina',label:'Retina',match:/retina|ora serrata/i,color:'#d4683f',description:'Light-sensitive neural layer: rods for dim light, cones for colour and detail.',pin:/^retina$/i},
   {id:'choroid',label:'Choroid',match:/choroid/i,color:'#5c2a27',description:'Vascular layer that supplies the outer retina.'},
   {id:'sclera',label:'Sclera',match:/sclera/i,color:'#f3ede5',description:'The tough white outer coat, continuous with the cornea at the limbus.',pin:/^sclera$/i},
  ]},
 {id:'skin',name:'Skin',latin:'Cutis',summary:'A block of skin in cross-section: epidermis, dermis and subcutaneous fat with hair, glands, vessels and nerve endings.',
  facts:[{label:'Function',value:'Barrier against microbes, water loss and UV; temperature control; sensation; vitamin D synthesis'},{label:'Location',value:'Covers the whole body surface'},{label:'Area',value:'About 1.5–2 m² in adults'},{label:'Thickness',value:'From about 0.5 mm on the eyelids to several millimetres on the back, palms and soles'},{label:'Blood supply',value:'Deep and superficial cutaneous plexuses; the epidermis itself has no vessels'},{label:'Tissue',value:'Epidermis (keratinised stratified squamous epithelium) on the dermis (connective tissue), over the hypodermis (fat)'}],
  note:'Burn depth follows the layers: superficial burns stay in the epidermis, partial-thickness burns reach the dermis, and full-thickness burns destroy both and can be painless because the nerve endings are gone.',
  view:{az:30,el:24},explode:.9,source:'Model: MedSchoolZone schematic of skin histology (not to scale).',
  inside:{label:'Hide the tissue layers',offLabel:'Show the tissue layers',mode:'hide',hide:['epidermis','dermis','hypodermis']},
  groups:[
   {id:'epidermis',label:'Epidermis',match:/^epidermis$/i,color:'#e8c2a4',description:'Keratinised stratified squamous epithelium with no blood vessels. From deep to surface: stratum basale, spinosum, granulosum, lucidum (thick skin only) and corneum.',pin:/^epidermis$/i},
   {id:'dermis',label:'Dermis',match:/^dermis$/i,color:'#e3a294',description:'Collagen and elastic connective tissue: the papillary dermis (loose, with capillary loops and Meissner corpuscles) over the dense reticular dermis.',pin:/^dermis$/i},
   {id:'hypodermis',label:'Hypodermis (subcutaneous fat)',match:/hypodermis|fat lobules/i,color:'#f0cf74',description:'Fat and loose connective tissue that insulates, stores energy and cushions; strictly speaking it lies beneath the skin.',pin:/^hypodermis/i},
   {id:'hair',label:'Hair shaft',match:/hair shaft/i,color:'#3b2a20',description:'Dead keratinised cells pushed up by the dividing matrix cells of the hair bulb.',pin:/hair shaft/i},
   {id:'follicle',label:'Hair follicle and bulb',match:/hair follicle|hair bulb|dermal papilla of hair/i,color:'#d6ad86',description:'An epidermal down-growth into the dermis. The bulb’s matrix produces the hair, fed by blood vessels in the dermal papilla.',pin:/hair bulb/i},
   {id:'sebaceous',label:'Sebaceous gland',match:/sebaceous/i,color:'#f2e2a0',description:'Holocrine glands that empty sebum into the hair follicle; blocked follicles cause acne.',pin:/sebaceous/i},
   {id:'arrector',label:'Arrector pili muscle',match:/arrector/i,color:'#b9554c',description:'Smooth muscle under sympathetic control that pulls the hair upright: goosebumps.',pin:/arrector/i},
   {id:'sweat',label:'Eccrine sweat gland and duct',match:/sweat/i,color:'#93bdd3',description:'Coiled glands in the deep dermis that secrete watery sweat for cooling through a pore on the surface. Apocrine glands (axilla, groin) open into hair follicles instead.',pin:/eccrine coil/i},
   {id:'arteries',label:'Arteries',match:/^arteries/i,color:'#c7352d',description:'Deep and superficial plexuses; dermal vessels widen or narrow to control heat loss.',pin:/^arteries/i},
   {id:'veins',label:'Veins',match:/^veins/i,color:'#46568f',description:'Drain the dermal capillary loops back through the superficial and deep plexuses.'},
   {id:'nerve',label:'Cutaneous nerve',match:/cutaneous nerve/i,color:'#e2bf55',description:'Sensory fibres ending freely (pain, temperature, itch) or in specialised mechanoreceptors.'},
   {id:'pacinian',label:'Pacinian corpuscle',match:/pacinian/i,color:'#efe3cf',description:'Onion-like lamellated receptor in the deep dermis and hypodermis that senses vibration and deep pressure.',pin:/pacinian/i},
   {id:'meissner',label:'Meissner corpuscle',match:/meissner/i,color:'#f1cdb9',description:'Sits in the dermal papillae, most dense in fingertips and lips: fine, light touch.',pin:/meissner/i},
  ]},
];
export const ORGAN_BY_ID=new Map(ORGANS.map(o=>[o.id,o]));

/** Which organ view (if any) to suggest for a structure picked in the full-body atlas. */
export function organForStructure(name:string,system:string):OrganId|null{
 const n=name.toLowerCase();
 if(system==='cardiac'&&!/ventricle of brain|lateral ventricle|third ventricle|fourth ventricle/.test(n))return 'heart';
 if(/\bheart\b|coronary|cardiac vein|aortic valve|mitral|tricuspid|pulmonary valve|papillary muscle/.test(n))return 'heart';
 if(/brain|cerebr|cerebell|gyrus|hippocamp|thalam|pons|medulla oblongata|midbrain|corpus callosum|lateral ventricle|third ventricle|fourth ventricle|insula|amygdala|caudate|putamen|globus pallidus/.test(n))return 'brain';
 if(/lung|bronch|trachea|lingul/.test(n))return 'lungs';
 if(/liver|hepatovenous|caudate lobe|hepatic duct|biliary tree/.test(n))return 'liver';
 if(/pancrea/.test(n))return 'pancreas';
 if(/duoden|jejun|ileum/.test(n))return 'small-intestine';
 if(/colon|caecum|cecum|appendix|rectum/.test(n))return 'large-intestine';
 if(/kidney|renal (pelvis|cortex|medulla|pyramid)/.test(n))return 'kidney';
 if(/eyeball|cornea|sclera|retina|\blens\b|\biris\b|vitreous|choroid/.test(n))return 'eye';
 if(/^skin$/.test(n))return 'skin';
 return null;
}
