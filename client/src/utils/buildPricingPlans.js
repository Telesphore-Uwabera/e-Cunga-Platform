/**
 * Same plan rows as /pricing (Essential, Professional, Enterprise) for reuse on the home page.
 * @param {(key: string) => string} t - i18n `t`
 * @param {'monthly' | 'annual'} billing
 */
export function buildPricingPlans(t, billing) {
  const essentialPts = t('pricing.essentialPts') || [];
  const proPts = t('pricing.professionalPts') || [];
  const entPts = t('pricing.customPts') || [];

  if (billing === 'annual') {
    return [
      {
        name: t('pricing.essential'),
        amount: t('pricing.priceEssYr'),
        suffix: t('pricing.suffixYr'),
        isCustom: false,
        points: essentialPts,
        cta: t('marketing.getStarted'),
        link: '/register?plan=essential',
        highlight: false,
      },
      {
        name: t('pricing.professional'),
        amount: t('pricing.priceProYr'),
        suffix: t('pricing.suffixYr'),
        isCustom: false,
        points: proPts,
        cta: t('marketing.getStarted'),
        link: '/register?plan=professional',
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
      link: '/register?plan=essential',
      highlight: false,
    },
    {
      name: t('pricing.professional'),
      amount: t('pricing.priceProMo'),
      suffix: t('pricing.suffixMo'),
      isCustom: false,
      points: proPts,
      cta: t('marketing.getStarted'),
      link: '/register?plan=professional',
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
