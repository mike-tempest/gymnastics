'use client';

import {
  ArrowRight,
  Download,
  Layers,
  PoundSterling,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

const SQUADS_TEMPLATE_CSV = `squad_name,description,min_age,max_age,coach_name,training_times,max_capacity
Recreational,Beginners building confidence and fundamental movement skills,5,8,Emma Clarke,Mon/Wed 17:00-17:45,20
Development,Improving technique across the apparatus,8,12,Tom Barker,Tue/Thu 18:00-19:00,24
Competition,Squad training for county and regional competitions,11,17,Rachel Hughes,Mon/Wed/Fri 19:00-20:30,30`;

const MEMBERS_TEMPLATE_CSV = `member_first_name,member_last_name,date_of_birth,gender,registration_number,governing_body,squad,medical_notes,emergency_contact,parent_name,parent_email,parent_phone,family_name,address_line1,address_line2,city,postcode
Olivia,Thompson,2015-03-14,F,1234567,BRITISH_GYMNASTICS,Development,Mild asthma (inhaler kept in kit bag),Sarah Thompson 07700 900123,Sarah Thompson,sarah.thompson@example.co.uk,07700 900123,Thompson,14 Riverside Close,,Tunbridge Wells,TN1 2AB
Harry,Thompson,2013-08-22,M,1234568,BRITISH_GYMNASTICS,Competition,,Sarah Thompson 07700 900123,Sarah Thompson,sarah.thompson@example.co.uk,07700 900123,Thompson,14 Riverside Close,,Tunbridge Wells,TN1 2AB
Amelia,Patel,2014-05-09,F,2345678,BRITISH_GYMNASTICS,Development,,Priya Patel 07700 900456,Priya Patel,priya.patel@example.co.uk,07700 900456,Patel,7 Orchard Way,Flat 2,Maidstone,ME14 5XY`;

const STAFF_TEMPLATE_CSV = `first_name,last_name,email,role
Emma,Clarke,emma.clarke@example.co.uk,head_coach
Tom,Barker,tom.barker@example.co.uk,squad_coach
Janet,Osei,janet.osei@example.co.uk,treasurer`;

const FEES_TEMPLATE_CSV = `name,description,amount,frequency,applies_to,squad_name
Club Membership,Annual club membership for all ${MEMBER_NOUN_PLURAL_LOWER},45.00,annual,club,
Development Squad Fees,Monthly training fees for the Development squad,32.50,monthly,squad,Development
Competition Squad Fees,Monthly training fees for the Competition squad,44.00,monthly,squad,Competition`;

interface ImportCard {
  title: string;
  description: string;
  hint: string;
  icon: LucideIcon;
  templateCsv: string;
  templateFileName: string;
  importHref: string;
}

const IMPORT_CARDS: ImportCard[] = [
  {
    title: 'Squads',
    description:
      'Set up your training squads first so people and fee structures can be matched to them.',
    hint: 'Columns: squad_name, description, min_age, max_age, coach_name, training_times, max_capacity. Only squad_name is required.',
    icon: Layers,
    templateCsv: SQUADS_TEMPLATE_CSV,
    templateFileName: 'squads_import_template.csv',
    importHref: '/admin/import/squads',
  },
  {
    title: 'Members',
    description: `Import ${MEMBER_NOUN_PLURAL_LOWER} together with their parent and family details. Rows sharing a parent email are grouped into one family.`,
    hint: 'Columns include member_first_name, member_last_name, date_of_birth, gender, registration_number, governing_body, squad, plus parent, family and address details. Dates can be YYYY-MM-DD or DD/MM/YYYY.',
    icon: Users,
    templateCsv: MEMBERS_TEMPLATE_CSV,
    templateFileName: 'members_import_template.csv',
    importHref: '/admin/import/members',
  },
  {
    title: 'Staff',
    description: 'Add your coaches, committee members and volunteers along with their club roles.',
    hint: 'Columns: first_name, last_name, email, role. Roles: treasurer, head_coach, squad_coach, welfare_officer, competition_secretary.',
    icon: UserCog,
    templateCsv: STAFF_TEMPLATE_CSV,
    templateFileName: 'staff_import_template.csv',
    importHref: '/admin/import/staff',
  },
  {
    title: 'Fee structures',
    description: 'Set up your membership and squad fees so billing is ready from day one.',
    hint: 'Columns: name, description, amount, frequency (monthly, annual or one_time), applies_to (club or squad), squad_name.',
    icon: PoundSterling,
    templateCsv: FEES_TEMPLATE_CSV,
    templateFileName: 'fee_structures_import_template.csv',
    importHref: '/admin/import/fees',
  },
];

function downloadTemplate(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`${fileName} downloaded`);
}

/**
 * The file-by-file route, for a club that would rather fill in a template than
 * follow the guided migration. Every card here is also a step in the wizard.
 */
export default function ImportTemplateCards() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {IMPORT_CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="bg-dark-primary border-white/10">
            <CardContent className="p-6 sm:p-8 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 rounded-lg bg-lime/20 shrink-0">
                  <Icon className="w-6 h-6 text-lime" />
                </div>
                <h3 className="font-serif text-2xl text-white tracking-tight">{card.title}</h3>
              </div>

              <p className="text-white/70 text-sm mb-4">{card.description}</p>
              <p className="text-white/50 text-xs leading-relaxed mb-6">{card.hint}</p>

              <div className="mt-auto flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => downloadTemplate(card.templateCsv, card.templateFileName)}
                  className="min-h-[48px] px-6 py-3 bg-transparent text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-5 h-5" />
                  <span>Download template</span>
                </button>
                <Link
                  href={card.importHref}
                  className="min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-dark transition-all flex items-center justify-center gap-2"
                >
                  <span>Import {card.title.toLowerCase()}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
