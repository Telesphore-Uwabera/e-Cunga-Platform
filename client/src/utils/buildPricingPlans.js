/**
 * Same plan rows as /pricing (Essential, Professional, Enterprise) for reuse on the home page.
 * @param {(key: string) => string} t - i18n `t`
 * @param {'monthly' | 'annual'} billing
 */
export function buildPricingPlans(t, billing) {
  const essentialPts = [t('pricing.ptEssM1'), t('pricing.ptEssM2'), t('pricing.ptEssM3')];
  const proPts = [t('pricing.ptProM1'), t('pricing.ptProM2'), t('pricing.ptProM3'), t('pricing.ptProM4')];
  const entPts = [t('pricing.ptEnt1'), t('pricing.ptEnt2'), t('pricing.ptEnt3'), t('pricing.ptEnt4')];

  if (billing === 'annual') {
    return [
      {
        name: t('pricing.essential'),
        amount: t('pricing.priceEssYr'),
        suffix: t('pricing.suffixYr'),
        isCustom: false,
        points: essentialPts,
        cta: t('marketing.getStarted'),
        link: '/register',
        highlight: false,
      },
      {
        name: t('pricing.professional'),
        amount: t('pricing.priceProYr'),
        suffix: t('pricing.suffixYr'),
        isCustom: false,
        points: proPts,
        cta: t('marketing.getStarted'),
        link: '/register',
        highlight: true,
      },
      {
        name: t('pricing.enterprise'),
        amount: '',
        suffix: '',
        isCustom: true,
        points: entPts,
        cta: t('pricing.ctaSales'),
        link: '/contact',
        highlight: false,
      },
    ];
  }

  return [
    {
      name: t('pricing.essential'),
      amount: t('pricing.priceEssMo'),
      suffix: t('pricing.suffixMo'),
      isCustom: false,
      points: essentialPts,
      cta: t('marketing.getStarted'),
      link: '/register',
      highlight: false,
    },
    {
      name: t('pricing.professional'),
      amount: t('pricing.priceProMo'),
      suffix: t('pricing.suffixMo'),
      isCustom: false,
      points: proPts,
      cta: t('marketing.getStarted'),
      link: '/register',
      highlight: true,
    },
    {
      name: t('pricing.enterprise'),
      amount: '',
      suffix: '',
      isCustom: true,
      points: entPts,
      cta: t('pricing.ctaSales'),
      link: '/contact',
      highlight: false,
    },
  ];
}
