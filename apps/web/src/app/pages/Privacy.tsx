import { PublicNav } from "../components/PublicNav";
import { PublicFooter } from "../components/PublicFooter";
import { LandingBackground } from "../landing/LandingBackground";

const POLICY_INTRO = [
  "Solace is designed to provide AI-assisted personal reflection, emotional wellness, self-development, goal-setting, journaling, habit tracking, mood tracking, sleep tracking, and related features. Because users may choose to discuss highly personal matters, Solace may process information that is sensitive in nature. This Privacy Policy explains how [LEGAL ENTITY NAME], doing business as Solace (“Solace,” “we,” “us,” “our,” or the “Company”), collects, uses, stores, processes, discloses, protects, and otherwise handles information when you use the Solace websites, mobile applications, artificial-intelligence systems, software, communications, features, content, products, and services (collectively, the “Services”).",
  "This Privacy Policy should be read together with the Solace Terms of Use & Conditions, the Solace AI, Mental Health & Wellness Disclaimer, any applicable Consumer Health Data Privacy Notice, any applicable Cookie or Tracking Technologies Notice, and any additional notice presented when you use a specific Solace feature.",
  "By accessing or using Solace, you acknowledge the privacy practices described in this Policy. Where applicable law requires affirmative consent rather than notice alone, Solace will seek that consent separately."
] as const;

const POLICY_SECTIONS = [
  {
    "heading": "1. WHO OPERATES SOLACE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace (formerly operated under the name MeetEzri) is operated by [LEGAL ENTITY NAME], doing business as Solace (“Solace,” “we,” “us,” “our,” or the “Company”)."
      },
      {
        "type": "paragraph",
        "text": "[BUSINESS ADDRESS], [CITY, STATE, ZIP], United States."
      },
      {
        "type": "paragraph",
        "text": "Privacy Contact: [PRIVACY EMAIL]   Legal Contact: [LEGAL EMAIL]   Customer Support: [SUPPORT EMAIL]"
      },
      {
        "type": "paragraph",
        "text": "For purposes of applicable privacy laws, [LEGAL ENTITY NAME] is the controller, business, or other responsible entity with respect to personal information processed through Solace unless otherwise stated in a supplemental notice."
      }
    ]
  },
  {
    "heading": "2. THIS IS A DISCLOSURE, NOT AN EXPANDED CONTRACT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "This Privacy Policy is a disclosure of Solace's data practices, provided to satisfy applicable legal notice requirements. It is not, and must not be construed as, a warranty, guarantee, or an independent contractual promise that expands Solace's obligations beyond what applicable law requires."
      },
      {
        "type": "paragraph",
        "text": "To the extent this Policy is treated as part of the agreement between you and Solace, it is governed by, and incorporates, the disclaimers, releases, assumption-of-risk provisions, limitations of liability, indemnification obligations, and binding arbitration and class-action-waiver provisions set out in the Solace Terms of Use & Conditions, which control in the event of any conflict regarding liability or dispute resolution."
      },
      {
        "type": "paragraph",
        "text": "Nothing in this Policy waives any privacy right that applicable law makes non-waivable."
      }
    ]
  },
  {
    "heading": "3. SCOPE OF THIS PRIVACY POLICY",
    "blocks": [
      {
        "type": "paragraph",
        "text": "This Privacy Policy applies only to information collected or processed through Solace-controlled Services. It does not govern, and Solace bears no responsibility for, the independent privacy practices of unrelated third-party websites, applications, healthcare providers, therapists, emergency services, crisis organizations, or other services that may be linked from or referenced within Solace. Third-party services operate under their own privacy policies and legal obligations, and you use them entirely at your own risk."
      }
    ]
  },
  {
    "heading": "4. AGE REQUIREMENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace is intended exclusively for individuals who are 18 years of age or older and is not intended for children. You may not create or maintain a Solace account if you are under 18."
      },
      {
        "type": "paragraph",
        "text": "If Solace learns that personal information has been collected from an individual who does not meet the applicable minimum age requirement, Solace may suspend or terminate the account and take reasonable steps to delete the information, subject to legal, security, record-retention, and safety requirements. Solace may implement age-assurance or age-verification measures at its discretion, and bears no liability for a user's misrepresentation of their age."
      }
    ]
  },
  {
    "heading": "5. ACCOUNT INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "We may collect information such as: first and last name; preferred name; email address; telephone number; username; password or authentication credentials; date or year of birth; confirmation that you are at least 18; profile photograph or avatar selections; account preferences; communication preferences; subscription status; account creation date; and unique account identifiers."
      }
    ]
  },
  {
    "heading": "6. AI CONVERSATION CONTENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "When you communicate with Solace, we process the information you choose to provide, which may include questions, prompts, statements, responses, reflections, personal experiences, descriptions of relationships, emotional concerns, goals, fears, worries, accomplishments, opinions, thoughts, preferences, life circumstances, career information, family information, wellness concerns, health-related information, uploaded material, and other content communicated during an interaction (collectively, “Conversation Content”)."
      },
      {
        "type": "paragraph",
        "text": "Conversation Content may be highly sensitive. You are solely responsible for exercising judgment about what you disclose to Solace, and Solace bears no liability for consequences flowing from your voluntary disclosure of sensitive information."
      }
    ]
  },
  {
    "heading": "7. JOURNAL INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If you use Solace's journaling functionality, we may process journal entries, dates and times of entries, journal prompts, tags or categories, self-selected themes, AI-generated summaries or reflections, journal-related goals, and other information voluntarily entered into journal fields. Access to journal content is restricted to systems and personnel with a legitimate need consistent with this Policy."
      }
    ]
  },
  {
    "heading": "8. MOOD, WELLNESS, HABIT, SLEEP, AND GOAL INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Depending on the features you use, we may process information relating to mood, emotional state, stress, habits, sleep, wellness, routines, goals, productivity, relationships, confidence, work-life balance, career development, financial wellness goals, mindfulness, life changes, personal growth, and other user-selected areas of focus. This information may constitute sensitive personal information, consumer health data, or a similar protected category under certain state laws, and is handled subject to the protections described in this Policy."
      }
    ]
  },
  {
    "heading": "9. HEALTH AND MENTAL-HEALTH RELATED INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Users may voluntarily discuss information involving physical health, mental health, emotional health, medications, diagnoses, symptoms, therapy, counseling, psychiatric care, medical treatment, substance use, trauma, grief, sleep, reproductive health, sexual health, disability, suicidal thoughts, self-harm, crisis circumstances, or other sensitive matters."
      },
      {
        "type": "paragraph",
        "text": "Solace is a general-purpose wellness and information technology platform. It is not a healthcare provider, does not act as a regulated health-records custodian of any kind, and does not represent that information you submit constitutes protected health information subject to any healthcare-specific regulatory framework. You agree not to submit information to Solace for any purpose requiring regulated medical-record handling."
      },
      {
        "type": "paragraph",
        "text": "Solace does not require you to disclose more sensitive information than reasonably necessary to use a particular feature, and you retain full discretion over what you choose to share."
      }
    ]
  },
  {
    "heading": "10. SAFETY AND CRISIS-RELATED INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may use automated and AI-assisted safety systems intended to identify language that may indicate circumstances such as self-harm, suicide, threats of violence, harm to another person, abuse, exploitation, overdose, serious medical emergencies, acute psychiatric crisis, or other circumstances involving potential serious harm."
      },
      {
        "type": "paragraph",
        "text": "When a safety signal is detected, Solace may process the relevant Conversation Content, risk classifications, contextual safety indicators, prior messages relevant to understanding immediate risk, account information, emergency-resource information, and approximate location information used to identify appropriate emergency resources."
      },
      {
        "type": "paragraph",
        "text": "Automated safety classification is a technical operational tool only. It is not a medical or psychological diagnosis, and Solace does not guarantee that it will correctly, consistently, or at all identify a genuine safety concern."
      }
    ]
  },
  {
    "heading": "11. EMERGENCY CONTACT INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where Solace provides or requires an emergency-contact feature, we may collect the contact's name, relationship to the user, telephone number, email address, and other authorized contact information. You represent that you have a lawful basis to provide another person's contact information to Solace for this purpose."
      },
      {
        "type": "paragraph",
        "text": "Providing an emergency contact does not guarantee that Solace will detect a crisis or successfully reach that person under any circumstance. Solace bears no liability for a failure to do so."
      }
    ]
  },
  {
    "heading": "12. SAFETY-RELATED DISCLOSURES",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If Solace identifies circumstances it reasonably believes present a serious or imminent threat of harm, Solace may, where permitted by applicable law, disclose limited relevant information to a designated emergency contact, emergency medical personnel, emergency services, law enforcement, crisis-response organizations, healthcare professionals, or another person or service reasonably able to assist. Solace will seek to limit such disclosures to information reasonably relevant to the safety concern."
      },
      {
        "type": "paragraph",
        "text": "This section creates no guarantee that Solace will identify every emergency, continuously monitor conversations, determine a user's physical location, reach an emergency contact, contact emergency services, or successfully prevent harm. Solace is not, and must never be treated as, an emergency-response service."
      }
    ]
  },
  {
    "heading": "13. INFORMATION ABOUT OTHER PEOPLE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Users may discuss spouses, partners, relatives, friends, coworkers, therapists, employers, or other individuals during Solace interactions. You are solely responsible for ensuring you have an appropriate basis to provide personal information concerning another individual, and Solace discourages providing unnecessary identifying information about third parties."
      }
    ]
  },
  {
    "heading": "14. INFORMATION GENERATED OR INFERRED BY SOLACE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may derive information from your interactions to provide functionality, including conversation themes, stated goals, preferences, recurring topics, interaction patterns, progress indicators, habit patterns, mood trends, sleep trends, engagement patterns, personalized recommendations, safety classifications, and AI-generated summaries."
      },
      {
        "type": "paragraph",
        "text": "Such inferred or generated information is not necessarily accurate merely because an AI system produced it, and must never be treated as a professional diagnosis or authoritative conclusion about you."
      }
    ]
  },
  {
    "heading": "15. DEVICE AND TECHNICAL INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "When you access Solace, we may automatically process IP address, browser, operating system, device type and model, application version, device identifiers, language, time zone, approximate geographic region, access date and time, authentication events, crash logs, diagnostic and performance information, security events, pages or screens accessed, and interaction information, in each case to operate, secure, diagnose, maintain, and improve Solace."
      }
    ]
  },
  {
    "heading": "16. LOCATION INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may derive general location information from an IP address or similar technical signals. Solace will not request precise GPS location unless a specific feature requires it and you receive appropriate notice and any legally required consent. Location information may be used to identify appropriate emergency-service or crisis-resource information, comply with jurisdictional requirements, prevent fraud, protect system security, or provide location-dependent Services you request."
      }
    ]
  },
  {
    "heading": "17. PAYMENT AND SUBSCRIPTION INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If you purchase a subscription or other paid Service, payment may be processed through Apple, Google, Stripe, or another approved payment processor. [INSERT ACTUAL PAYMENT PROVIDERS BEFORE PUBLICATION.] Depending on the payment system, Solace may receive purchase status, subscription plan, payment confirmation, billing country, transaction identifier, renewal status, cancellation status, refund information, and other limited billing-related information. Solace does not store full payment-card numbers handled exclusively by third-party payment processors."
      }
    ]
  },
  {
    "heading": "18. CUSTOMER SUPPORT COMMUNICATIONS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If you contact Solace support, we may collect your identity, contact information, communications, screenshots, technical details, account information, troubleshooting information, and other information reasonably necessary to respond to your inquiry. Do not send highly sensitive Conversation Content to customer support unless necessary to resolve your issue; Solace bears no liability for sensitive information you voluntarily include in a support request beyond what was required."
      }
    ]
  },
  {
    "heading": "19. HOW WE USE PERSONAL INFORMATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Subject to applicable law, Solace may process personal information to:"
      },
      {
        "type": "list",
        "items": [
          "Provide Solace: create and authenticate accounts, provide AI conversations, journaling, mood/habit/sleep/goal tracking, maintain session history, personalize permitted experiences, provide subscriptions, deliver requested communications, and provide customer support;",
          "Operate safety systems: recognize potential crisis signals, classify potentially unsafe interactions, interrupt prohibited harmful dialogue pathways, provide crisis-resource information, and carry out permitted safety escalation;",
          "Protect Solace: authenticate accounts, detect fraud and unauthorized access, prevent abuse, enforce the Terms of Use, investigate security incidents, and protect systems and intellectual property, including against prohibited automated extraction or scraping;",
          "Maintain and improve the Services: identify and correct technical problems, evaluate feature and safety-system performance, understand aggregate usage, improve reliability and accessibility, and develop new features; and",
          "Comply with law: respond to valid legal requests, comply with regulatory requirements, exercise and defend Solace's legal rights, prevent unlawful activity, and satisfy recordkeeping obligations."
        ]
      }
    ]
  },
  {
    "heading": "20. AI PROCESSING",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace uses artificial-intelligence technology to provide portions of the Services. Your information may accordingly be processed by Solace's own systems and by contracted AI, cloud, hosting, infrastructure, security, or related providers necessary to operate the Services."
      },
      {
        "type": "paragraph",
        "text": "Solace evaluates providers that receive sensitive Conversation Content and implements contractual, security, and data-governance protections it deems appropriate to the sensitivity of the information processed. Before this Policy is published, Solace must document each AI provider receiving Conversation Content, what information the provider receives, where it is processed, provider retention periods, whether provider personnel can access the information, whether the provider uses the information for its own model training, and applicable contractual restrictions."
      }
    ]
  },
  {
    "heading": "21. AI TRAINING AND MODEL IMPROVEMENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace's finalized practice must be inserted here before publication."
      },
      {
        "type": "paragraph",
        "text": "Solace's intended baseline policy is that it will not permit third-party general-purpose AI providers to use private Solace Conversation Content to independently train their general-purpose models where Solace has contractually selected enterprise or API services that prohibit such training."
      },
      {
        "type": "paragraph",
        "text": "Solace may use appropriately protected information to evaluate system quality, investigate safety failures, identify technical problems, and improve Solace-specific functionality and internal safety systems, subject to applicable law. Where consent is legally required before sensitive information may be used for model improvement, Solace will obtain it, and will provide a separate user choice before any identifiable private Conversation Content is used for optional AI-training purposes."
      }
    ]
  },
  {
    "heading": "22. HUMAN ACCESS TO PRIVATE CONTENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Private Conversation Content is not freely available to Solace personnel. Access is limited according to job responsibility and legitimate need. Authorized personnel or contractors may access limited information where reasonably necessary to respond to a user-requested support issue, investigate a security incident, investigate abuse or a Terms violation, investigate a potential safety failure, respond to a legal obligation, investigate a technical malfunction, or conduct authorized safety or quality review."
      },
      {
        "type": "paragraph",
        "text": "Such access is subject to confidentiality obligations, access controls, role-based permissions, logging, security safeguards, and internal policy."
      }
    ]
  },
  {
    "heading": "23. CONVERSATION HISTORY AND RETENTION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If conversation history is enabled, Solace may retain Conversation Content so users can review prior sessions, maintain continuity, view progress, and use related features. Solace provides reasonable controls to manage eligible stored content."
      },
      {
        "type": "paragraph",
        "text": "Before publication, Solace must establish and insert: Active conversation retention: [PERIOD]. Deleted conversation retention: [PERIOD]. Backup retention: [PERIOD]. Deletion requests remain subject to the limited exceptions described in this Policy."
      }
    ]
  },
  {
    "heading": "24. DATA MINIMIZATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace seeks to collect and process personal information reasonably necessary for legitimate business, safety, security, product, legal, and user-requested purposes, and avoids collecting sensitive personal information merely because it might later prove useful."
      }
    ]
  },
  {
    "heading": "25. DATA RETENTION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace retains personal information only for as long as reasonably necessary for the purposes described in this Policy, subject to legal and operational requirements, including account status, information type, user choices, safety requirements, security needs, contractual obligations, dispute resolution, fraud prevention, applicable law, and legal claims. Solace maintains a documented retention schedule addressing account information, conversation history, journal entries, mood/habit/sleep data, goal information, emergency-contact information, safety events, uploads, support records, payment records, system logs, security events, analytics, and backups."
      }
    ]
  },
  {
    "heading": "26. USER DELETION REQUESTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Users may request deletion of eligible personal information through Account Settings [PATH], the Privacy Request Portal [URL], or by email at [PRIVACY EMAIL]. Users may also delete individual conversations, journal entries, or other content directly within Solace where available."
      },
      {
        "type": "paragraph",
        "text": "Deletion may not immediately remove information from disaster-recovery systems or backups. Information may be retained where permitted or required to comply with law, complete transactions, detect fraud, maintain security, prevent abuse, preserve evidence of a Terms violation, address a safety incident, or establish or defend a legal claim. Retained information remains subject to appropriate safeguards."
      }
    ]
  },
  {
    "heading": "27. ACCOUNT DELETION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Users may request deletion of their Solace account. Upon eligible account deletion, Solace will delete or de-identify the personal information associated with the account except information reasonably retained for permitted legal, security, fraud-prevention, safety, accounting, or related purposes. Solace will clearly display the consequences of account deletion before completing the request."
      }
    ]
  },
  {
    "heading": "28. DE-IDENTIFIED AND AGGREGATED DATA",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may generate aggregated or de-identified information not reasonably linkable to an identifiable individual, and, subject to applicable law, may use such information for research, service analysis, safety evaluation, product development, statistical analysis, business planning, performance measurement, and understanding general usage patterns. Where applicable law requires Solace to maintain data in de-identified form, Solace will take reasonable measures not to reidentify it except as legally permitted."
      }
    ]
  },
  {
    "heading": "29. ADVERTISING",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace does not use the content of private AI conversations, private journal entries, or sensitive mental-health or wellness information to create third-party behavioral advertising profiles, and does not display advertising based on private sensitive topics a user discusses with Solace."
      },
      {
        "type": "paragraph",
        "text": "If Solace's advertising practices materially change, this Policy will be updated and any legally required user choice or consent will be implemented before such processing occurs."
      }
    ]
  },
  {
    "heading": "30. SALE OF PRIVATE CONVERSATION DATA",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace does not sell private Conversation Content, private journal content, or sensitive mental-health or wellness information for monetary consideration."
      },
      {
        "type": "paragraph",
        "text": "Certain state privacy laws define “sale” or “sharing” more broadly than an exchange for money. Solace evaluates cookies, analytics providers, SDKs, tracking technologies, and other disclosures separately to determine whether an opt-out or consent mechanism is legally required."
      }
    ]
  },
  {
    "heading": "31. COOKIES, SDKS, AND TRACKING TECHNOLOGIES",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may use essential cookies, authentication technologies, local storage, security technologies, software-development kits, analytics technologies, performance tools, and similar technologies for account login, security, preferences, fraud prevention, functionality, analytics, diagnostics, and performance measurement."
      },
      {
        "type": "paragraph",
        "text": "Solace does not deploy third-party advertising trackers into private conversation or journal environments in a manner that exposes sensitive content. Where applicable law requires consent to non-essential cookies or SDKs, Solace will provide an appropriate consent mechanism."
      }
    ]
  },
  {
    "heading": "32. SESSION REPLAY AND ANALYTICS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Any session-replay technology, analytics recording, or similar tool Solace uses is configured to prevent collection of sensitive Conversation Content, journal information, passwords, payment information, or other protected fields unless specifically necessary, lawful, and appropriately disclosed. [IDENTIFY ACTUAL ANALYTICS AND SESSION-REPLAY PROVIDERS BEFORE PUBLICATION.]"
      }
    ]
  },
  {
    "heading": "33. SERVICE PROVIDERS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may disclose personal information to companies that provide services on its behalf, including AI infrastructure providers, cloud-hosting providers, database providers, security companies, authentication providers, communications providers, payment processors, customer-support providers, analytics providers, professional advisors, and other technology providers. Service providers are contractually restricted regarding their use of personal information received from Solace."
      }
    ]
  },
  {
    "heading": "34. NO INDEPENDENT VENDOR USE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Service providers receiving personal information from Solace are required to process it only for authorized purposes, subject to applicable contracts and law. Solace does not knowingly permit service providers to independently monetize private Solace Conversation Content or sensitive wellness information for unrelated advertising purposes."
      }
    ]
  },
  {
    "heading": "35. LEGAL DISCLOSURES",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may disclose information where reasonably necessary to comply with applicable law, respond to a valid subpoena, comply with a warrant or court order, respond to binding regulatory process, investigate fraud, protect Solace's legal rights, enforce agreements, protect users or others, prevent unlawful activity, or establish or defend legal claims. Solace may assess the validity and scope of governmental and legal requests where permitted, and may seek to narrow requests that appear overbroad."
      }
    ]
  },
  {
    "heading": "36. LAW-ENFORCEMENT REQUESTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace does not provide law enforcement with unrestricted access to user accounts or private Conversation Content. Information may be provided in response to legally valid compulsory process or other circumstances permitted by law. Where legally permitted, Solace may notify the affected user before producing information, but this Policy does not guarantee advance notification where prohibited by law, where emergency circumstances apply, or where notice is otherwise inappropriate."
      }
    ]
  },
  {
    "heading": "37. CORPORATE TRANSACTIONS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If Solace undergoes or considers a merger, acquisition, financing, restructuring, sale of assets, bankruptcy, investment transaction, or change of control, personal information may be reviewed or transferred in connection with the transaction. Any receiving entity remains subject to applicable law, and Solace will provide notice of material changes to the treatment of personal information where required."
      }
    ]
  },
  {
    "heading": "38. CONFIDENTIALITY IS NOT PROFESSIONAL PRIVILEGE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace is designed to protect user privacy, but communications with Solace are not protected by therapist-client, psychologist-patient, physician-patient, attorney-client, clergy, or other professional evidentiary privilege. Solace is a technology service, not the user's therapist, physician, lawyer, or other privileged professional, regardless of the personal nature of what a user discusses with the platform."
      },
      {
        "type": "paragraph",
        "text": "You should not assume that Conversation Content is legally immune from valid compulsory process."
      }
    ]
  },
  {
    "heading": "39. HEALTH-RELATED REGULATORY FRAMEWORKS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Whether any particular body of health-privacy law applies to information you provide to Solace depends on the specific circumstances, including Solace's role and any relationship with a regulated healthcare entity. Unless Solace expressly states otherwise in writing for a specific feature, you should not assume that information you voluntarily provide directly to Solace receives treatment under any healthcare-specific regulatory framework merely because the information concerns health or mental health."
      },
      {
        "type": "paragraph",
        "text": "Information processed by Solace may nonetheless qualify as “consumer health data,” “sensitive data,” “sensitive personal information,” or a similar protected category under certain state privacy statutes. Where applicable, Solace will provide the additional disclosures or consent mechanisms such laws require for the collection, use, sharing, or deletion of that information, including any jurisdiction-specific consumer health data notice."
      }
    ]
  },
  {
    "heading": "40. SECURITY SAFEGUARDS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace maintains administrative, technical, and organizational safeguards it deems reasonably designed to protect personal information, appropriate to the sensitivity of the information and applicable legal requirements. Measures may include encryption in transit and at rest, multifactor authentication for privileged access, role-based and least-privilege access controls, monitoring and security logging, vulnerability management, secure development practices, code review, penetration testing, incident-response procedures, vendor security assessments, backup protections, security training, and access-termination procedures. For security reasons, Solace does not publicly disclose detailed security architecture."
      }
    ]
  },
  {
    "heading": "41. NO ABSOLUTE SECURITY GUARANTEE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "No computer system, mobile application, communications network, cloud platform, database, encryption system, or electronic storage system can be guaranteed to be completely secure. Solace cannot and does not promise that unauthorized access, loss, misuse, disclosure, alteration, destruction, cyberattack, or other security event will never occur, and disclaims liability for such an event except to the extent directly caused by Solace's own gross negligence or willful misconduct."
      },
      {
        "type": "paragraph",
        "text": "This statement does not waive or reduce any security obligation imposed by applicable law."
      }
    ]
  },
  {
    "heading": "42. SECURITY INCIDENTS AND BREACH NOTIFICATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace maintains processes intended to identify, investigate, contain, document, remediate, and respond to qualifying information-security incidents. Where a breach triggers a legal notification requirement, Solace will provide legally required notifications to affected individuals, regulators, or government agencies within applicable time requirements, under whichever state, federal, or other breach-notification laws apply to the incident. Nothing in this Policy limits any notification obligation established by law."
      }
    ]
  },
  {
    "heading": "43. YOUR PRIVACY RIGHTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Depending on your residence and applicable law, you may have rights to: confirm whether Solace processes your information; access it; receive a copy; correct inaccuracies; delete certain information; obtain a portable copy; withdraw consent; opt out of certain targeted advertising; opt out of a qualifying sale or sharing; limit certain processing of sensitive personal information; appeal certain privacy-request decisions; and exercise these rights without unlawful discrimination. These rights are subject to applicable legal limitations and exceptions."
      }
    ]
  },
  {
    "heading": "44. HOW TO EXERCISE PRIVACY RIGHTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Privacy requests may be submitted through the Privacy Portal [URL], by email at [PRIVACY EMAIL], or in-app at [SETTINGS > PRIVACY PATH]. Please identify the right you wish to exercise. Solace may verify your identity before processing certain requests to protect your information, and will not request more information than reasonably necessary for verification."
      }
    ]
  },
  {
    "heading": "45. AUTHORIZED AGENTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where permitted by law, you may authorize another person to make a privacy request on your behalf. Solace may request documentation reasonably necessary to verify your identity, the agent's identity, and the agent's authority."
      }
    ]
  },
  {
    "heading": "46. APPEALS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where applicable law grants an appeal right, a user whose privacy request has been denied may appeal by contacting [PRIVACY APPEALS EMAIL]. The appeal will be reviewed consistent with applicable law."
      }
    ]
  },
  {
    "heading": "47. NON-DISCRIMINATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace will not unlawfully discriminate against you for exercising a privacy right. Some features depend on information you request to delete or decline to provide; if that information is necessary for the functionality you request, the feature may no longer operate after deletion or withdrawal of consent, and Solace bears no liability for that resulting loss of functionality."
      }
    ]
  },
  {
    "heading": "48. CALIFORNIA PRIVACY DISCLOSURES",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If the California Consumer Privacy Act, as amended, applies to Solace, California residents may have rights concerning disclosure of collected personal information, access, correction, deletion, qualifying sale or sharing, sensitive personal information, and non-discrimination. Solace will provide any additional disclosures California law requires based on its actual processing practices."
      }
    ]
  },
  {
    "heading": "49. WASHINGTON CONSUMER HEALTH DATA",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where Washington's My Health My Data Act applies, Solace will provide any separate Consumer Health Data Privacy Policy the law requires and will obtain consent or authorization where required for applicable collection, sharing, or sale of consumer health data, describing the categories collected, purposes, sources, categories shared, recipients, user rights, and methods of exercising those rights."
      }
    ]
  },
  {
    "heading": "50. OTHER U.S. STATE PRIVACY LAWS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace will evaluate and comply with privacy laws applicable to Services offered to residents of other U.S. jurisdictions, which may require supplemental notices, consumer-health-data notices, consent, opt-out mechanisms, additional sensitive-data protections, or state-specific rights procedures. A user's statutory rights are not eliminated merely because they are not individually listed in this general Policy."
      }
    ]
  },
  {
    "heading": "51. INTERNATIONAL USERS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If Solace is offered outside the United States, personal information may be processed in the United States or other countries in which Solace or its service providers operate, which may have privacy laws different from those of your home jurisdiction. Where applicable international law requires additional protections for cross-border transfers, Solace will implement appropriate transfer mechanisms."
      }
    ]
  },
  {
    "heading": "52. EUROPEAN ECONOMIC AREA",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where the EU General Data Protection Regulation applies, Solace will process personal data only where it has an appropriate legal basis, which may include performance of a contract, consent, compliance with a legal obligation, legitimate interests not overridden by your rights, or another lawful basis. Health information and other special categories of personal data will be processed only where an appropriate Article 9 condition or other legal authorization exists. EEA users may have rights to access, correction, deletion, restriction, objection, portability, withdrawal of consent, and complaint to a supervisory authority."
      }
    ]
  },
  {
    "heading": "53. UNITED KINGDOM",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where UK data-protection law applies, Solace will process personal information consistent with the UK GDPR and Data Protection Act. Health information and certain other categories may constitute special-category data requiring additional legal protection. UK users may have rights to access, rectification, erasure, restriction, objection, portability, and withdrawal of consent."
      }
    ]
  },
  {
    "heading": "54. AUTOMATED DECISION-MAKING",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace uses automated systems to provide AI-generated responses, personalization, and safety functionality. Solace does not intend ordinary AI conversations to constitute legally significant automated decisions concerning employment, credit, insurance, housing, healthcare eligibility, legal rights, or similar high-impact matters. Where applicable law grants rights relating to legally significant automated decision-making, Solace will comply with those requirements."
      }
    ]
  },
  {
    "heading": "55. AI SAFETY CLASSIFICATION",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Safety classifiers may automatically assign risk indicators to communications to determine whether a conversation should continue normally, receive supportive safety messaging, be redirected, prohibit dangerous assistance, display crisis resources, or activate another safety mechanism. These classifications are operational safety tools only — they are not medical diagnoses, psychological diagnoses, or determinations about a user's character, and Solace disclaims any suggestion otherwise."
      }
    ]
  },
  {
    "heading": "56. USER CONTROL AND TRANSPARENCY",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Where reasonably available, Solace provides users with controls concerning account information, conversation history, journal entries, communication preferences, data deletion, privacy requests, and other configurable privacy choices, and seeks to present important privacy choices in understandable language."
      }
    ]
  },
  {
    "heading": "57. PRODUCT RESEARCH AND SAFETY TESTING",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may use appropriately limited data to evaluate system reliability, unsafe response rates, crisis-classifier performance, false positives and negatives, bias, model performance, security, feature performance, and product usability. Where identifiable sensitive Conversation Content is used for research, development, or quality review beyond what is necessary to provide the Service, Solace will evaluate whether consent, de-identification, additional disclosure, or other protections are required."
      }
    ]
  },
  {
    "heading": "58. PROFESSIONAL AND LEGAL ADVISORS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may disclose limited information to attorneys, accountants, auditors, insurers, cybersecurity specialists, investigators, or other professional advisors where reasonably necessary for legal advice, regulatory compliance, insurance, security, investigations, audits, or protection of legal rights. Such parties are subject to professional, contractual, or legal confidentiality obligations."
      }
    ]
  },
  {
    "heading": "59. DATA TRANSFERS TO SUCCESSORS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "If Solace or its business is sold or transferred, personal information may transfer to the successor organization as part of the business assets. A successor remains subject to applicable legal restrictions. If a successor proposes a materially different use of previously collected sensitive information, additional notice or consent will be provided where required by law."
      }
    ]
  },
  {
    "heading": "60. CHANGES TO THIS PRIVACY POLICY",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Solace may update this Policy as its Services, features, privacy practices, vendors, applicable law, security practices, or geographic footprint change. The date at the top of this Policy indicates the latest version. For material changes, Solace will provide notice as required by applicable law, and if a new use of previously collected sensitive information requires consent, Solace will obtain it where required."
      }
    ]
  },
  {
    "heading": "61. CONTACT US",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Questions, concerns, complaints, or privacy requests may be directed to Solace, operated by [LEGAL ENTITY NAME], at Privacy: [PRIVACY EMAIL], Legal: [LEGAL EMAIL], Support: [SUPPORT EMAIL], or by mail to [LEGAL ENTITY NAME], [BUSINESS ADDRESS], [CITY, STATE ZIP], United States."
      }
    ]
  },
  {
    "heading": "62. PRIVACY COMMITMENTS",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Subject to the specific provisions of this Policy and applicable law, Solace's intended privacy principles are:"
      },
      {
        "type": "list",
        "items": [
          "We do not sell private Solace conversations for monetary consideration.",
          "We do not use private mental-health, wellness, journal, or AI conversation content to target third-party behavioral advertising.",
          "We seek to minimize access to private Conversation Content.",
          "We seek to restrict service providers from independently exploiting private Solace Conversation Content for unrelated purposes.",
          "We use safety-related information for legitimate safety purposes rather than advertising.",
          "We do not represent that any user conversation receives treatment under a healthcare-specific regulatory framework or professional privilege when the law does not provide it.",
          "We do not promise absolute security that no technology company can truthfully guarantee.",
          "We provide legally required privacy rights and notices where applicable."
        ]
      },
      {
        "type": "paragraph",
        "text": "These principles describe Solace's intended practice and do not create contractual rights beyond what this Policy and applicable law separately provide, and remain subject to change as described in the section on changes to this Policy."
      }
    ]
  },
  {
    "heading": "63. USER ACKNOWLEDGMENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "By using Solace after being presented with this Privacy Policy, you acknowledge that you have received notice of the information practices described in it. Your acknowledgment does not waive any privacy right that applicable law makes non-waivable. Where separate consent is legally required for particular processing of sensitive information, Solace will request that consent separately."
      }
    ]
  },
  {
    "heading": "64. RELATIONSHIP TO THE TERMS OF USE",
    "blocks": [
      {
        "type": "paragraph",
        "text": "Any dispute concerning this Privacy Policy or Solace's data practices is subject to the dispute-notice, informal-resolution, binding-arbitration, class-action-waiver, limitation-period, limitation-of-liability, and indemnification provisions of the Solace Terms of Use & Conditions, which are incorporated into this Policy by reference to the fullest extent permitted by applicable law."
      }
    ]
  },
  {
    "heading": "66. DOCUMENT INTEGRATION REQUIREMENT",
    "blocks": [
      {
        "type": "paragraph",
        "text": "No Solace marketing statement, onboarding screen, consent mechanism, Terms provision, AI disclaimer, developer documentation, safety policy, cookie notice, app-store disclosure, or product functionality should materially contradict this Privacy Policy. If Solace's actual technology differs from this Policy, the technology and/or this Policy must be corrected before the representation is made to users."
      },
      {
        "type": "paragraph",
        "text": "Privacy protection must exist in both the legal documentation and the actual product architecture."
      }
    ]
  }
] as const;

export function Privacy() {
  return (
    <div className="solace-landing relative min-h-screen overflow-x-hidden">
      <LandingBackground />

      <div className="relative z-10">
        <PublicNav variant="cinematic" />

        <main className="landing-section px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:pb-24">
          <article className="mx-auto max-w-4xl">
            <header className="mb-12 text-center sm:mb-16">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/75">SOLACE</p>
              <p className="mt-2 text-sm text-[var(--solace-ds-text-muted)]">formerly MeetEzri</p>
              <h1 className="landing-serif mt-5 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                PRIVACY POLICY
              </h1>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 text-sm text-white/80 sm:flex-row sm:gap-6">
                <p><span className="font-semibold text-white">Effective Date:</span> 8/28/2026</p>
                <p><span className="font-semibold text-white">Last Updated:</span> 9/04/2026</p>
              </div>
            </header>

            <section
              aria-label="Important Privacy Notice"
              className="mb-10 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.08] p-5 shadow-[0_18px_60px_rgba(76,29,149,0.18)] backdrop-blur-sm sm:p-7"
            >
              <p className="text-sm font-semibold leading-7 text-white sm:text-base">
                IMPORTANT PRIVACY NOTICE. THIS POLICY DESCRIBES HOW SOLACE HANDLES SENSITIVE PERSONAL INFORMATION AND SHOULD BE READ TOGETHER WITH THE SOLACE TERMS OF USE & CONDITIONS.
              </p>
            </section>

            <div className="space-y-5 text-[15px] leading-7 text-[var(--solace-ds-text-muted)] sm:text-base sm:leading-8">
              {POLICY_INTRO.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>

            <div className="mt-14 space-y-12 sm:mt-16 sm:space-y-14">
              {POLICY_SECTIONS.map((section) => {
                const sectionId = "privacy-" + section.heading.split(".")[0];
                return (
                  <section key={section.heading} aria-labelledby={sectionId}>
                    <h2
                      id={sectionId}
                      className="landing-serif text-2xl font-semibold leading-tight text-white sm:text-3xl"
                    >
                      {section.heading}
                    </h2>

                    <div className="mt-5 space-y-5 text-[15px] leading-7 text-[var(--solace-ds-text-muted)] sm:text-base sm:leading-8">
                      {section.blocks.map((block, blockIndex) =>
                        block.type === "list" ? (
                          <ul
                            key={section.heading + "-list-" + blockIndex}
                            className="list-disc space-y-3 pl-6 marker:text-fuchsia-300"
                          >
                            {block.items.map((item) => (
                              <li key={item} className="pl-1">{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p key={section.heading + "-paragraph-" + blockIndex}>{block.text}</p>
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        </main>

        <PublicFooter />
      </div>
    </div>
  );
}
