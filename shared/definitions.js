// ─────────────────────────────────────────────────────────────────────────────
// shared/definitions.js
//
// Single source of truth for the data definitions that were previously
// copy-pasted between the form and dashboard pages and drifted silently.
// Loaded as a plain <script> before each page's own script; top-level const
// declarations here are visible to the scripts that follow.
//
// EDITING RULES
//   - EPA ids are APPEND-ONLY. Never rename one and never reuse one. 31 of the
//     35 evaluations on file predate scores_detail and resolve their labels
//     from ROTATIONS below; a renamed id silently unlabels them.
//   - To remove an EPA from the form, mark it `retired: true`. activeEpas()
//     drops it from the form, buildScoresDetail() and computeMilestoneScores(),
//     while its definition stays here to label older rows. Never delete an entry.
//   - Milestone codes in `milestones` must exist in MILESTONE_DEFS.
//   - Changing anything that alters the measurement means bumping FORM_VERSION
//     in index.html, which is deliberately NOT here: it versions the form, not
//     the definitions.
//   - After editing, bump the ?v= query string on every <script src> that loads
//     this file, or browsers will keep serving the cached copy.
//
// Pages that load this file:
//   index.html, resident-dashboard/, faculty/, faculty-dashboard/
// ─────────────────────────────────────────────────────────────────────────────

const SCALE_LABELS = {
  0: "Not Yet Entrustable",
  1: "Complete Supervision",
  2: "Partial Supervision",
  3: "Minimal Supervision",
  4: "As if Independent",
  5: "Aspirational",
  na: "N/A"
};

const MILESTONE_DEFS = {
  PC1: 'Care of the Acutely Ill Patient',
  PC2: 'Care of Patients with Chronic Illness',
  PC3: 'Health Promotion and Wellness',
  PC4: 'Ongoing Care — Undifferentiated Symptoms',
  PC5: 'Management of Procedural Care',
  MK1: 'Medical Knowledge — Breadth and Depth',
  MK2: 'Critical Thinking and Decision Making',
  SBP1: 'Patient Safety and Quality Improvement',
  SBP2: 'System Navigation for Patient-Centered Care',
  SBP3: 'Physician Role in Health Care Systems',
  SBP4: 'Advocacy',
  PBLI1: 'Evidence-Based and Informed Practice',
  PBLI2: 'Reflective Practice and Personal Growth',
  PROF1: 'Professional Behavior and Ethical Principles',
  PROF2: 'Accountability/Conscientiousness',
  PROF3: 'Self-Awareness and Help-Seeking',
  ICS1: 'Patient- and Family-Centered Communication',
  ICS2: 'Interprofessional and Team Communication',
  ICS3: 'Communication within Health Care Systems'
};

const ROTATIONS = {
  'Inpatient Medicine': {
    epas: [
      { id: 'med1', text: 'Evaluate and manage an adult patient admitted with an acute medical illness', context: 'Consider: prioritized differential diagnosis for acute presentations; appropriate diagnostic workup; management plan for common and complex acute conditions; recognizing clinical deterioration; incorporating psychosocial factors.', milestones: ['PC1','MK2'] },
      { id: 'med2', text: 'Perform safe and effective transitions of care', context: 'Consider: comprehensive discharge summaries; medication reconciliation; appropriate follow-up; structured handoff tools (e.g., I-PASS); communicating pending results; patient insurance, transportation, and social support.', milestones: ['SBP2','ICS3'] },
      { id: 'med3', text: 'Coordinate multidisciplinary inpatient care', context: 'Consider: clear communication with consultants; synthesizing recommendations into a unified care plan; working with nursing, pharmacy, social work, case management; resolving conflicting recommendations; leading interdisciplinary rounds.', milestones: ['ICS2','SBP2'] },
      { id: 'med4', text: 'Identify and respond to patient safety events on the inpatient service', context: 'Consider: recognizing system factors contributing to errors; reporting through institutional systems; participating in safety event analysis; communicating with patients and families; suggesting error prevention strategies.', milestones: ['SBP1'] },
      { id: 'med5', text: 'Communicate with patients and families about diagnosis, prognosis, and goals of care', context: 'Consider: delivering difficult news sensitively; conducting family meetings; shared decision-making regarding treatment plans and advance directives; health literacy–appropriate language; managing conflict.', milestones: ['ICS1','PROF1'] },
      { id: 'med6', text: 'Document clinical reasoning in inpatient notes', context: 'Consider: organized admission, progress, and discharge notes reflecting diagnostic and therapeutic reasoning; avoiding inappropriate copy-pasting; updating the problem list; timely documentation.', milestones: ['ICS3'] },
      { id: 'med7', text: 'Perform Procedures', context: 'Consider: obtaining informed consent; proper technique (e.g., paracentesis, central venous catheter insertion, thoracentesis, lumbar puncture); sterile technique; recognizing and managing complications; accurate documentation.', milestones: ['PC5'] },
    ]
  },
  'Continuity Care Clinic': {
    epas: [
      { id: 'afmc1', text: 'Manage patients with multiple chronic conditions longitudinally', context: 'Consider: treatment plans for diabetes, hypertension, hyperlipidemia, depression; balancing competing comorbidities; collaborative goal-setting; evidence-based guidelines with patient preferences.', milestones: ['PC2','MK1'] },
      { id: 'afmc2', text: 'Conduct age- and risk-appropriate preventive care', context: 'Consider: USPSTF/AAFP screening guidelines; immunizations; wellness exams; shared decision-making on competing guidelines; barriers to preventive care.', milestones: ['PC3'] },
      { id: 'afmc3', text: 'Evaluate and manage undifferentiated symptoms over time', context: 'Consider: differential for symptoms without clear diagnosis; tolerating diagnostic uncertainty; cost-effective workup; patient education on expected course; multidisciplinary coordination.', milestones: ['PC4'] },
      { id: 'afmc4', text: 'Perform common office procedures', context: 'Consider: skin biopsies, joint injections, IUD/Nexplanon insertion/removal, toenail removal, cryotherapy; informed consent; appropriate technique; complication management.', milestones: ['PC5'] },
      { id: 'afmc5', text: 'Apply evidence-based medicine to clinical decision-making in the office', context: 'Consider: formulating clinical questions; appraising guidelines and primary literature; integrating evidence with patient preferences; recognizing clinical reasoning errors.', milestones: ['PBLI1','MK2'] },
      { id: 'afmc6', text: 'Coordinate care across settings and disciplines for continuity patients', context: 'Consider: managing referrals; coordinating with behavioral health, social work, community resources; navigating insurance/cost barriers; ensuring continuity across settings.', milestones: ['SBP2','SBP3'] },
      { id: 'afmc7', text: 'Engage in panel management and population health', context: 'Consider: using EHR tools to identify care gaps; chart audits; outreach to patients needing preventive services; participating in quality improvement initiatives.', milestones: ['PC3','SBP1'] },
      { id: 'afmc8', text: 'Demonstrate patient-centered communication across diverse encounters', context: 'Consider: motivational interviewing; shared decision-making; health literacy–appropriate language; recognizing cultural and language barriers; maintaining therapeutic relationships in challenging encounters.', milestones: ['ICS1','PROF1'] },
      { id: 'afmc9', text: 'Evaluate and manage patients with mental health conditions in the primary care setting', context: 'Consider: screening for depression, anxiety, PTSD, and substance use disorders; initiating and managing psychotropic medications; safety planning for patients with suicidal ideation; warm handoffs and collaborative care coordination with behavioral health; recognizing limitations and appropriate referral.', milestones: ['PC2','MK1','ICS1'] },
    ]
  },
  'Outpatient Pediatrics': {
    epas: [
      { id: 'opeds1', text: 'Conduct well-child visits across developmental stages', context: 'Consider: age-appropriate growth and developmental assessment (ASQ, M-CHAT); growth curves; immunizations per CDC/ACIP schedule; anticipatory guidance; developmental delay identification and referral.', milestones: ['PC3','MK1'] },
      { id: 'opeds2', text: 'Evaluate and manage common pediatric outpatient conditions', context: 'Consider: otitis media, pharyngitis, URI, eczema, asthma, ADHD; differentiating viral from bacterial illness; age- and weight-appropriate medications; subspecialty referral.', milestones: ['PC2','PC4','MK1'] },
      { id: 'opeds3', text: 'Identify and respond to child abuse and neglect', context: 'Consider: recognizing concerning physical findings; behavioral indicators of abuse; mandatory reporting obligations; objective documentation; coordination with social services and CPS.', milestones: ['PROF1','SBP2'] },
      { id: 'opeds4', text: 'Provide adolescent-specific care', context: 'Consider: confidential screening for depression, substance use, sexual health, eating disorders; contraceptive counseling; minor consent and confidentiality laws; gender-affirming care needs.', milestones: ['ICS1','PC3','PROF1'] },
      { id: 'opeds5', text: 'Communicate with families about vaccine hesitancy and preventive care', context: 'Consider: motivational interviewing for parental vaccine concerns; addressing misinformation non-judgmentally; shared decision-making; documenting declined vaccines.', milestones: ['ICS1','MK1'] },
      { id: 'opeds6', text: 'Evaluate and manage the newborn in the outpatient setting', context: 'Consider: newborn discharge exam and early visits; feeding adequacy; weight gain and jaundice; newborn screening results; congenital anomalies; postpartum depression screening.', milestones: ['PC1','MK1','PC3'] },
      { id: 'opeds7', text: 'Coordinate care for children with special health care needs', context: 'Consider: medical home model for complex conditions (autism, cerebral palsy); coordinating subspecialists, therapists, school systems; individualized care plans; insurance/authorization navigation.', milestones: ['SBP2','PC2','SBP3'] },
    ]
  },
  'Emergency Department': {
    epas: [
      { id: 'er1', text: 'Triage and initiate evaluation of undifferentiated acute presentations', context: 'Consider: rapid assessment of chief complaint and vital signs; focused differential; initial workup; acuity determination; identifying life-threatening conditions; reassessment with new data.', milestones: ['PC1','MK2'] },
      { id: 'er2', text: 'Manage multiple patients simultaneously in the ED', context: 'Consider: prioritizing among patients of varying acuity; timely reassessment; efficient disposition; time management; situational awareness; recognizing when to ask for help.', milestones: ['PC1','PROF2'] },
      { id: 'er3', text: 'Assess, resuscitate and stabilize an acute trauma or acutely ill patient', context: 'Consider: primary survey (ABCDE); life-threatening injury prioritization; resuscitation including hemorrhage control, fluid/blood products, airway management; trauma bay procedures; closed-loop team communication; secondary survey.', milestones: ['PC1','PC5','MK2','ICS2'] },
      { id: 'er4', text: 'Perform common ED procedures', context: 'Consider: laceration repair, abscess I&D, splinting/casting, joint reduction, procedural sedation; informed consent; appropriate technique; complication recognition and management.', milestones: ['PC5'] },
      { id: 'er5', text: 'Determine appropriate disposition from the ED', context: 'Consider: admission vs. observation vs. discharge; risk stratification; follow-up arrangement; discharge instructions with return precautions; social work/case management involvement.', milestones: ['SBP2','SBP3'] },
      { id: 'er6', text: 'Communicate effectively with patients and families in high-acuity, time-pressured situations', context: 'Consider: delivering bad news sensitively; rapid informed consent; communicating with distressed families; jargon-free language; managing expectations; maintaining professionalism under pressure.', milestones: ['ICS1','PROF1'] },
      { id: 'er7', text: 'Request and coordinate consultations in the ED', context: 'Consider: formulating clear clinical questions; structured communication of findings; integrating consultant recommendations; following up on recommendations; resolving disagreements professionally.', milestones: ['ICS2'] },
    ]
  },
  'ICU': {
    epas: [
      { id: 'icu1', text: 'Recognize and initiate stabilization of a critically ill patient', context: 'Consider: rapid ABC assessment; initiating resuscitation; activating protocols (sepsis bundle, code blue); time-sensitive prioritization; early clinical deterioration recognition; code leadership.', milestones: ['PC1','MK2'] },
      { id: 'icu2', text: 'Manage mechanical ventilation', context: 'Consider: appropriate initial ventilator settings; arterial blood gas interpretation; adjusting ventilator parameters; recognizing ventilator-associated complications; extubation indications and timing.', milestones: ['PC1','MK1'] },
      { id: 'icu3', text: 'Manage hemodynamic support', context: 'Consider: recognizing and diagnosing shock etiologies; selecting and titrating vasopressors/inotropes; volume status assessment; fluid resuscitation management.', milestones: ['PC1','MK1'] },
      { id: 'icu4', text: 'Perform ICU procedures', context: 'Consider: arterial line placement, central venous catheter insertion, intubation, and/or lumbar puncture; informed consent; sterile technique; complication recognition and management; accurate documentation.', milestones: ['PC5'] },
      { id: 'icu5', text: 'Lead goals-of-care and end-of-life discussions in the ICU', context: 'Consider: building rapport with families in crisis; honest and compassionate prognosis discussions; code status decisions; patient values and advance directives; withdrawal of life-sustaining treatment; palliative care coordination.', milestones: ['ICS1','PROF1'] },
      { id: 'icu6', text: 'Coordinate care of a critically ill patient with multiple organ system involvement', context: 'Consider: synthesizing input from multiple subspecialty consultants; prioritizing interventions with competing organ system needs; communicating a unified plan; anticipating complications.', milestones: ['SBP2','ICS2','PC1'] },
      { id: 'icu7', text: 'Perform structured ICU handoffs', context: 'Consider: standardized handoff tool; communicating patient acuity, active problems, recent changes, contingency plans; closed-loop communication; prioritizing sickest patients; code status and family dynamics.', milestones: ['SBP2','ICS3'] },
    ]
  },
  'Inpatient Pediatrics': {
    epas: [
      { id: 'ipeds1', text: 'Evaluate and manage common pediatric inpatient conditions', context: 'Consider: bronchiolitis, pneumonia, asthma exacerbation, croup, dehydration, neonatal jaundice, febrile seizures; weight-based medication dosing; age-appropriate vital sign interpretation; level of care determination.', milestones: ['PC1','MK1'] },
      { id: 'ipeds2', text: 'Recognize and initiate management of the acutely ill child', context: 'Consider: sepsis, respiratory failure, status epilepticus, DKA; PALS algorithms; weight-based fluid boluses; PICU escalation; communicating urgency to the team.', milestones: ['PC1','MK2'] },
      { id: 'ipeds3', text: 'Communicate with parents and caregivers about their child\'s illness', context: 'Consider: diagnosis and treatment plan in health literacy–appropriate language; addressing parental anxiety; caregivers as partners in care; teach-back; navigating parental preference conflicts; interpreter use.', milestones: ['ICS1'] },
      { id: 'ipeds4', text: 'Perform pediatric procedures', context: 'Consider: I&D, lumbar puncture, NG tube placement; age-appropriate pain management and distraction; informed consent from caregivers; pediatric anatomy considerations; complication management.', milestones: ['PC5'] },
      { id: 'ipeds5', text: 'Coordinate discharge planning for pediatric patients', context: 'Consider: medication reconciliation with weight-based dosing; caregiver education on medication administration and warning signs; PCP follow-up arrangement; social determinants; social work coordination.', milestones: ['SBP2','ICS3'] },
      { id: 'ipeds6', text: 'Coordinate multidisciplinary care for hospitalized children', context: 'Consider: communication with pediatric subspecialists, nursing, respiratory therapy, child life, social work; synthesizing consultant recommendations; interdisciplinary rounds; closed-loop communication during critical situations.', milestones: ['ICS2','SBP2'] },
      { id: 'ipeds7', text: 'Perform structured pediatric handoffs', context: 'Consider: standardized handoff tool; patient acuity, weight-based medications, contingency plans; age-specific concerns (feeding tolerance, respiratory status in bronchiolitis); parental concerns and psychosocial factors.', milestones: ['SBP2','ICS3'] },
    ]
  },
  'Labor & Delivery': {
    epas: [
      { id: 'ld1', text: 'Manage normal labor and perform spontaneous vaginal delivery', context: 'Consider: monitoring labor progress; fetal heart rate tracing interpretation (Category I, II, III); managing active labor including augmentation; spontaneous vaginal delivery; third stage management; perineal laceration assessment and repair.', milestones: ['PC1','PC5','MK1'] },
      { id: 'ld2', text: 'Recognize and respond to obstetric emergencies', context: 'Consider: shoulder dystocia maneuvers; postpartum hemorrhage recognition and treatment; non-reassuring fetal heart tracings; cord prolapse; eclampsia recognition and treatment; calm and clear team communication.', milestones: ['PC1','MK2'] },
      { id: 'ld3', text: 'Perform procedures', context: 'Consider: accurate cervical exams; amniotomy; fetal scalp electrodes and intrauterine pressure catheters; perineal laceration repair (1st–4th degree); circumcision; operative vaginal delivery assistance.', milestones: ['PC5'] },
      { id: 'ld4', text: 'Provide immediate newborn care', context: 'Consider: newborn assessment and Apgar scoring; neonatal resuscitation per NRP guidelines; NICU transfer indications; initial newborn exam; counseling parents on newborn care, feeding, and warning signs.', milestones: ['PC1','MK1'] },
      { id: 'ld5', text: 'Communicate with laboring patients and families about labor progress, interventions, and complications', context: 'Consider: discussing labor progress in understandable terms; explaining induction/augmentation/operative delivery indications; shared decision-making; communicating cesarean section indications sensitively; addressing birth plan preferences.', milestones: ['ICS1'] },
      { id: 'ld6', text: 'Perform structured handoffs', context: 'Consider: labor status, cervical exam findings, fetal heart rate pattern, maternal/fetal risk factors, and contingency plans during shift changes; standardized handoff tool; ensuring receiving provider understands anticipated complications.', milestones: ['SBP2','ICS3'] },
    ]
  },
  'Professionalism': {
    epas: [
      { id: 'prof1', text: 'Demonstrate professional behavior appropriate to the clinical setting', context: 'Consider: arriving on time and prepared; respectful interactions with patients, families, and all team members; constructive response to feedback; recognizing personal limitations; ethical conduct; composure in stressful situations.', milestones: ['PROF1','PROF2','PROF3'] },
      { id: 'prof2', text: 'Seek and incorporate feedback to improve performance', context: 'Consider: receptivity to feedback from faculty, peers, and staff; self-reflection on clinical performance; identifying learning gaps; developing and implementing a learning plan; using performance data to measure improvement.', milestones: ['PBLI2','PROF3'] },
      { id: 'prof3', text: 'Demonstrate effective interprofessional teamwork', context: 'Consider: respectful communication with all team members; clear consultation requests; closed-loop communication; constructive feedback to peers and learners; coordinating multiple team member recommendations; resolving interprofessional conflict.', milestones: ['ICS2'] },
      { id: 'prof4', text: 'Advocate for individual patients\' needs within the health care system', context: 'Consider: navigating insurance barriers and prior authorizations; connecting patients with community resources; considering cost and social determinants in clinical decisions; identifying health disparities.', milestones: ['SBP3','SBP4'] },
    ]
  },
  'Inpatient Surgery': {
    epas: [
      { id: 'surg1', text: 'Evaluate and manage common surgical conditions', context: 'Consider: diagnosing acute abdomen, appendicitis, cholecystitis, bowel obstruction, hernias; surgical vs. conservative management indications; focused surgical history and physical; recognizing when urgent surgical consultation is needed.', milestones: ['PC1','MK1'] },
      { id: 'surg2', text: 'Provide perioperative care', context: 'Consider: preoperative risk assessment and medication management; postoperative complication monitoring (DVT, infection, ileus, bleeding); multimodal pain management; wound care; coordination with anesthesia and surgery teams.', milestones: ['PC1','MK1'] },
      { id: 'surg3', text: 'Assist in the operating room', context: 'Consider: sterile technique; appropriate tissue handling; knot tying and wound closure; understanding the procedure and anticipating next steps; intraoperative communication with the surgical team; professionalism during long procedures.', milestones: ['PC5'] },
      { id: 'surg4', text: 'Counsel patients about surgical procedures and alternatives', context: 'Consider: explaining risks, benefits, and alternatives in patient-friendly language; obtaining informed consent; independent risk and appropriateness assessment; advocating against unnecessary procedures.', milestones: ['PC5','ICS1'] },
      { id: 'surg5', text: 'Assess, resuscitate and stabilize an acute trauma patient', context: 'Consider: primary survey (ABCDE); life-threatening injury prioritization; resuscitation including hemorrhage control, fluids, airway management; trauma bay procedures; closed-loop team communication; secondary survey; disposition coordination.', milestones: ['PC1','PC5','MK2','ICS2'] },
      { id: 'surg6', text: 'Coordinate postoperative transitions of care', context: 'Consider: discharge planning including medication reconciliation, wound care instructions, activity restrictions, follow-up appointments; communicating with the patient\'s PCP; identifying rehabilitation/SNF needs; documentation of hospital course.', milestones: ['SBP2','ICS3'] },
    ]
  },
  'Urgent Care': {
    epas: [
      { id: 'uc1', text: 'Evaluate and manage acute, undifferentiated presentations in the urgent care setting', context: 'Consider: assessing walk-in patients with acute complaints (chest pain, abdominal pain, lacerations, URI); focused differential diagnosis; ED transfer vs. outpatient management determination; red flag recognition.', milestones: ['PC1','PC4','MK2'] },
      { id: 'uc2', text: 'Perform common urgent care procedures', context: 'Consider: laceration repair, abscess I&D, foreign body removal, splinting, point-of-care testing interpretation; informed consent; appropriate technique; recognizing scope limitations.', milestones: ['PC5'] },
      { id: 'uc3', text: 'Provide appropriate follow-up planning and safety-netting', context: 'Consider: clear discharge instructions with return precautions; PCP follow-up arrangement; communication with the patient\'s continuity provider; identifying patients needing additional resources.', milestones: ['SBP2','ICS1'] },
      { id: 'uc4', text: 'Manage patient flow and prioritize among multiple simultaneous patients', context: 'Consider: efficient patient evaluation; appropriate ancillary testing; timely disposition decisions; situational awareness across multiple patients; effective communication with nursing and support staff.', milestones: ['PC1','PROF2'] },
    ]
  },
  'Women\'s Health Clinic': {
    epas: [
      { id: 'wh1', text: 'Provide comprehensive well-woman care', context: 'Consider: pelvic exams and Pap smears; clinical breast exams; age-appropriate cancer screening; STI screening and counseling; HPV immunization; USPSTF and ACOG guidelines; sexual health and reproductive planning.', milestones: ['PC3','PC5'] },
      { id: 'wh2', text: 'Evaluate and manage common gynecologic complaints', context: 'Consider: abnormal uterine bleeding, vaginitis, pelvic pain, dysmenorrhea, menopause symptoms, urinary incontinence; appropriate diagnostic workup; evidence-based treatment; gynecologic referral indications.', milestones: ['PC2','MK1'] },
      { id: 'wh3', text: 'Provide contraceptive management including LARC procedures', context: 'Consider: counseling on all contraceptive methods including efficacy, risks, and benefits; LARC insertion and removal; complication management; contraceptive myths; patient autonomy.', milestones: ['PC5','ICS1'] },
      { id: 'wh4', text: 'Perform colposcopy and manage abnormal cervical cancer screening results', context: 'Consider: interpreting Pap smear and HPV co-testing results per ASCCP guidelines; colposcopy with directed biopsy; transformation zone identification; biopsy result follow-up and management counseling.', milestones: ['PC5','PBLI1'] },
      { id: 'wh5', text: 'Provide routine prenatal care', context: 'Consider: initial and subsequent prenatal visits including dating and risk assessment; prenatal labs and screening tests; fetal growth and maternal health monitoring; screening for gestational diabetes and preeclampsia; delivery plan development.', milestones: ['PC3','PC2','MK1'] },
      { id: 'wh6', text: 'Evaluate and manage early pregnancy complications', context: 'Consider: vaginal bleeding in early pregnancy (threatened, inevitable, incomplete, missed abortion); ectopic pregnancy diagnosis and management; quantitative hCG and early ultrasound interpretation; counseling patients about pregnancy loss with sensitivity.', milestones: ['PC1','ICS1','MK1'] },
      { id: 'wh7', text: 'Counsel patients on menopause management and hormone therapy', context: 'Consider: menopausal symptom assessment; HRT risks and benefits per current evidence; non-hormonal alternatives; osteoporosis and cardiovascular risk screening; sexual health concerns; shared decision-making.', milestones: ['PC2','PBLI1','ICS1'] },
    ]
  },
  // ── Added 2026-08-25: six rotations, 40 EPAs, from VCMC_EPA_New_Rotations.md ──
  'Inpatient Palliative Care': {
    epas: [
      { id: 'pall1', text: 'Assess and manage pain in patients with serious illness', context: 'Consider: comprehensive pain assessment including total pain; opioid selection, titration, and rotation; equianalgesic conversion; adjuvant agents for neuropathic pain; anticipating and treating opioid side effects; safe prescribing in patients with concurrent substance use disorder.', milestones: ['PC1','MK1'] },
      { id: 'pall2', text: 'Assess and manage non-pain symptoms of serious illness', context: 'Consider: dyspnea, nausea and vomiting, constipation, delirium, terminal secretions, anxiety; non-pharmacologic and pharmacologic management; distinguishing reversible causes from disease progression.', milestones: ['PC2','MK1'] },
      { id: 'pall3', text: 'Conduct a goals-of-care conversation and deliver serious news', context: 'Consider: use of a structured framework (SPIKES, REMAP, Ask-Tell-Ask); eliciting patient values before making recommendations; responding to emotion; avoiding jargon; managing family disagreement; documenting the conversation.', milestones: ['ICS1','PROF1'] },
      { id: 'pall4', text: 'Formulate and communicate prognosis', context: 'Consider: using functional status and disease trajectory to estimate prognosis; communicating prognostic uncertainty honestly; asking permission before sharing; balancing hope and realism; revisiting prognosis as the illness evolves.', milestones: ['MK2','ICS1'] },
      { id: 'pall5', text: 'Manage the actively dying patient', context: 'Consider: recognizing signs of imminent death; comfort-focused order sets; discontinuing non-beneficial interventions; ventilator withdrawal when indicated; preparing families for what to expect; care of the body and bereavement support.', milestones: ['PC1','MK1'] },
      { id: 'pall6', text: 'Address psychosocial, spiritual, and cultural dimensions of serious illness', context: 'Consider: screening for spiritual distress; engaging chaplaincy and social work; eliciting cultural preferences around disclosure and decision-making; assessing caregiver burden; recognizing grief and anticipatory loss.', milestones: ['ICS1','PROF1'] },
      { id: 'pall7', text: 'Coordinate hospice referral and transitions of care', context: 'Consider: hospice eligibility criteria and levels of care; explaining hospice accurately and correcting misconceptions; distinguishing hospice from palliative care; coordinating with the interdisciplinary team; ensuring medication and equipment continuity at discharge.', milestones: ['SBP2','ICS3'] },
    ]
  },
  'Addiction Medicine': {
    epas: [
      { id: 'addm1', text: 'Screen for and diagnose substance use disorders', context: 'Consider: validated screening tools (AUDIT-C, DAST, TAPS); applying DSM-5 criteria and severity; assessing readiness to change; reviewing the prescription drug monitoring program; taking a non-judgmental substance use history.', milestones: ['PC3','MK1'] },
      { id: 'addm2', text: 'Assess and manage alcohol withdrawal', context: 'Consider: risk stratification for complicated withdrawal and seizure history; CIWA-based or phenobarbital protocols; recognizing and treating Wernicke encephalopathy; identifying patients needing inpatient level of care.', milestones: ['PC1','MK1'] },
      { id: 'addm3', text: 'Manage opioid withdrawal and initiate medication for opioid use disorder', context: 'Consider: COWS assessment; buprenorphine initiation including low-dose and standard approaches; methadone initiation and regulatory requirements; naltrexone candidacy; managing precipitated withdrawal; treating withdrawal symptoms adjunctively.', milestones: ['PC1','MK1'] },
      { id: 'addm4', text: 'Prescribe and manage medications for alcohol and other substance use disorders', context: 'Consider: naltrexone, acamprosate, and disulfiram selection and monitoring; evidence for off-label agents; managing stimulant use disorder without an approved pharmacotherapy; monitoring adherence and response over time.', milestones: ['PC2','MK1'] },
      { id: 'addm5', text: 'Apply harm reduction principles in clinical care', context: 'Consider: naloxone prescribing and overdose education; safer use counseling; syringe service and fentanyl test strip referral; wound and endocarditis risk counseling; meeting patients who are not seeking abstinence without withdrawing care.', milestones: ['PC3','SBP4'] },
      { id: 'addm6', text: 'Counsel patients using motivational interviewing and address stigma', context: 'Consider: open questions, affirmations, reflective listening, and summarizing; rolling with resistance rather than confronting; using non-stigmatizing language in speech and documentation; recognizing personal bias toward patients who use drugs.', milestones: ['ICS1','PROF1'] },
      { id: 'addm7', text: 'Evaluate and manage co-occurring medical and psychiatric conditions', context: 'Consider: injection-related infections, viral hepatitis, HIV and PrEP; depression, PTSD, and anxiety; pain management in patients on MOUD; distinguishing intoxication and withdrawal from primary psychiatric illness.', milestones: ['PC2','MK2'] },
      { id: 'addm8', text: 'Coordinate transitions to community treatment and recovery support', context: 'Consider: warm handoffs to outpatient MOUD; arranging bridge prescriptions; residential and intensive outpatient referral; recovery support services and peer navigators; addressing insurance, housing, and transportation barriers.', milestones: ['SBP2','SBP3'] },
    ]
  },
  'Procedural Care': {
    epas: [
      { id: 'proc1', text: 'Determine indications, contraindications, and alternatives for the procedure', context: 'Consider: correct patient and procedure selection; reviewing relevant imaging and laboratory values including coagulation status; identifying absolute and relative contraindications; considering non-procedural alternatives; recognizing when to defer or refer.', milestones: ['MK1','PC5'] },
      { id: 'proc2', text: 'Obtain informed consent', context: 'Consider: describing the procedure, risks, benefits, and alternatives in plain language; assessing capacity; using an interpreter when indicated; inviting and answering questions; documenting consent appropriately.', milestones: ['PC5','ICS1'] },
      { id: 'proc3', text: 'Prepare the patient, equipment, and environment', context: 'Consider: correct positioning; sterile technique and appropriate barrier precautions; equipment selection and setup; local anesthesia; pre-procedure time-out and site verification; ensuring appropriate monitoring and assistance.', milestones: ['PC5','SBP1'] },
      { id: 'proc4', text: 'Perform the procedure with appropriate technique', context: 'Consider: anatomic landmarks and ultrasound guidance where applicable; efficient and safe instrument handling; adherence to procedural steps; awareness of one\'s own skill limits; knowing when to stop and call for help.', milestones: ['PC5'] },
      { id: 'proc5', text: 'Recognize and manage procedural complications', context: 'Consider: anticipating likely complications for this procedure; early recognition of bleeding, infection, organ injury, or anesthetic reaction; immediate stabilization; escalating appropriately; disclosing complications to the patient honestly.', milestones: ['PC5','MK2'] },
      { id: 'proc6', text: 'Document the procedure and arrange post-procedure care', context: 'Consider: complete procedure note including indication, consent, technique, findings, complications, and specimens; post-procedure orders and monitoring; patient instructions and return precautions; arranging follow-up and results communication.', milestones: ['ICS3','SBP2'] },
    ]
  },
  'Backpack / Street Medicine': {
    epas: [
      { id: 'strm1', text: 'Deliver clinical care in unsheltered and non-traditional settings', context: 'Consider: performing a focused history and exam without standard infrastructure; prioritizing what can be accomplished in a single encounter; adapting to limited diagnostics and no reliable follow-up; carrying and using an appropriate field formulary.', milestones: ['PC1','PC4','SBP3'] },
      { id: 'strm2', text: 'Establish trust and therapeutic rapport with people experiencing homelessness', context: 'Consider: approaching an encampment respectfully and asking permission; introducing oneself without assumptions; tolerating incremental relationship building across visits; recognizing prior negative healthcare experiences; maintaining continuity where possible.', milestones: ['ICS1','PROF1'] },
      { id: 'strm3', text: 'Manage chronic disease under conditions of housing instability', context: 'Consider: realistic regimen simplification; medications that do not require refrigeration or strict timing; insulin and anticoagulation risk in unstable settings; adapting goals to circumstance without abandoning standards of care.', milestones: ['PC2','SBP3'] },
      { id: 'strm4', text: 'Evaluate and manage wound care, skin and soft tissue infection, and foot care', context: 'Consider: abscess drainage and wound debridement in the field; cellulitis versus abscess versus necrotizing infection; chronic venous and diabetic ulcer care; frostbite and immersion foot; tetanus status; deciding when field care is inadequate and transfer is required.', milestones: ['PC1','PC5'] },
      { id: 'strm5', text: 'Integrate substance use and mental health care into street outreach', context: 'Consider: field-based buprenorphine initiation; naloxone distribution and overdose education; recognizing psychiatric decompensation outdoors; assessing safety and capacity; engaging patients who decline transport to higher levels of care.', milestones: ['PC2','ICS1'] },
      { id: 'strm6', text: 'Navigate social determinants and connect patients to resources', context: 'Consider: housing navigation and coordinated entry; benefits, identification documents, and phone access; food, hygiene, and transportation; coordinating with outreach workers, shelters, and community organizations; documenting in a way that supports benefit applications.', milestones: ['SBP2','SBP4'] },
      { id: 'strm7', text: 'Practice trauma-informed care and maintain situational safety in the field', context: 'Consider: recognizing trauma responses and avoiding re-traumatization; offering choice and control within the encounter; team safety planning and awareness of surroundings; protecting patient privacy in public settings; recognizing personal emotional response and vicarious trauma.', milestones: ['PROF1','PROF3'] },
    ]
  },
  'Inpatient Subspecialty Consultation': {
    epas: [
      { id: 'ipsub1', text: 'Perform a focused consultation that answers the referring clinical question', context: 'Consider: clarifying the actual question being asked; targeted history and examination rather than a repeat comprehensive workup; reviewing prior records and outside data; timeliness of the consult; recognizing when the question needs reframing.', milestones: ['PC1','MK2'] },
      { id: 'ipsub2', text: 'Apply subspecialty knowledge to diagnosis and management', context: 'Consider: applying discipline-specific differential diagnosis and guidelines; weighing evidence quality; adapting recommendations to the patient\'s comorbidities and goals; recognizing the limits of one\'s own subspecialty knowledge.', milestones: ['MK1','PC2'] },
      { id: 'ipsub3', text: 'Interpret subspecialty-specific diagnostic studies', context: 'Consider: independent interpretation before reading the report; understanding test characteristics and pre-test probability; recognizing artifact and incidental findings; avoiding low-value testing; correlating results with the clinical picture.', milestones: ['MK1','MK2'] },
      { id: 'ipsub4', text: 'Communicate consultative recommendations to the primary team', context: 'Consider: clear and prioritized written recommendations rather than an exhaustive list; direct verbal communication for urgent or nuanced issues; explaining reasoning so the team can act independently; professional handling of disagreement; behaving as a consultant rather than a co-manager unless asked.', milestones: ['ICS2','ICS3'] },
      { id: 'ipsub5', text: 'Provide ongoing follow-up and adjust recommendations', context: 'Consider: daily reassessment while the consult is active; responding to changes in clinical status; signing off appropriately with clear criteria for re-consultation; ensuring outpatient subspecialty follow-up is arranged.', milestones: ['PC2','ICS2'] },
      { id: 'ipsub6', text: 'Perform or assist with subspecialty procedures', context: 'Consider: understanding indications and alternatives for discipline-specific procedures; obtaining informed consent; appropriate technique and sterile practice; recognizing and managing complications; accurate documentation.', milestones: ['PC5'] },
    ]
  },
  'Outpatient Subspecialty Clinic': {
    epas: [
      { id: 'opsub1', text: 'Evaluate and manage patients referred for subspecialty assessment', context: 'Consider: reviewing the referral question and prior workup before the visit; focused evaluation appropriate to the subspecialty; formulating an assessment and plan within the scope of the consultation; recognizing what belongs back with primary care.', milestones: ['PC2','MK1'] },
      { id: 'opsub2', text: 'Apply subspecialty evidence and guidelines to outpatient decision-making', context: 'Consider: current discipline-specific guidelines; appraising evidence quality; individualizing recommendations to comorbidity, cost, and patient preference; recognizing where guidelines conflict or evidence is weak.', milestones: ['MK1','PBLI1'] },
      { id: 'opsub3', text: 'Interpret subspecialty diagnostic studies in the ambulatory setting', context: 'Consider: independent interpretation of discipline-specific testing; appropriate test selection and sequencing; cost-conscious and guideline-concordant ordering; communicating results and their limitations to patients.', milestones: ['MK1','MK2'] },
      { id: 'opsub4', text: 'Communicate findings and recommendations to the referring provider', context: 'Consider: a timely and legible consult letter; a clear statement of the diagnosis, plan, and division of responsibility; specifying what the referring provider should monitor; avoiding recommendations that assume subspecialty follow-up that will not occur.', milestones: ['ICS3','SBP2'] },
      { id: 'opsub5', text: 'Counsel patients about subspecialty diagnoses and treatment options', context: 'Consider: explaining a new or chronic subspecialty diagnosis in plain language; shared decision-making about treatment intensity; discussing prognosis and natural history; addressing medication cost, access, and adherence barriers.', milestones: ['ICS1'] },
      { id: 'opsub6', text: 'Perform subspecialty-relevant office procedures', context: 'Consider: discipline-specific ambulatory procedures; indications, contraindications, and informed consent; appropriate technique; recognizing and managing complications; documentation and post-procedure instructions.', milestones: ['PC5'] },
    ]
  },

};


// ── What a generic rotation was actually about ───────────────────────────────
//
// Three rotations describe a shape of encounter rather than a subject: Procedural
// Care does not say WHICH procedure, and the two Subspecialty rotations do not say
// WHICH specialty. Without this, every cardiology and neurology consult aggregates
// together and procedures cannot be counted at all.
//
// A live list rather than free text, deliberately. Free entry would recreate
// exactly the spelling drift that faculty names had - "central line", "Central
// Line" and "CVC" would each count separately.
//
// The values are NOT here. They live in the detail_options table and are loaded
// by shared/detail-options.js, so the list grows when someone types something
// genuinely new, a near-miss is offered to them first, and duplicates that slip
// through can be merged by a reviewer. Same shape as the faculty roster.
//
// `category` groups rotations onto one list: both Subspecialty rotations share
// 'subspecialty', because a specialty seen on the wards is plausible in clinic
// and two lists would drift apart for no benefit.
//
// A rotation absent from this object collects no detail and shows no extra field.

const ROTATION_DETAIL = {
  'Procedural Care': {
    category: 'procedure',
    label: 'Which procedure?',
    hint: 'Pick from the list, or type a new one and it will be added for next time.',
  },
  'Inpatient Subspecialty Consultation': {
    category: 'subspecialty',
    label: 'Which subspecialty?',
    hint: 'The service the resident was consulting on. Type a new one to add it.',
  },
  'Outpatient Subspecialty Clinic': {
    category: 'subspecialty',
    label: 'Which subspecialty?',
    hint: 'The clinic the resident was seeing patients in. Type a new one to add it.',
  },
};

// The detail configuration for a rotation, or null if it collects none.
function rotationDetailFor(rotationName) {
  return ROTATION_DETAIL[rotationName] || null;
}
// ── Faculty evaluation items (faculty/ and faculty-dashboard/) ──
// The wording stored on each rating row is what the dashboard counts by;
// this list only decides what is asked and in what order. Reordering is
// safe, but retired wording must keep its exact text to stay matchable.
const QUESTIONS = [
  "Encourages residents to participate actively in discussions",
  "Is respectful toward residents",
  "Is easily approachable",
  "Is easily available/reachable",
  "Displays enthusiasm for teaching",
  "Provides appropriate balance of supervision and autonomy",
  "Gives specific, actionable feedback",
  "Solicits/is open to feedback",
  "Demonstrates diagnostic proficiency and explains clinical reasoning",
  "Finds ways to effectively balance education and patient care"
];
