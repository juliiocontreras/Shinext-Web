const BASE_PRICE={
  home:850,
  airbnb:950,
  office:1200,
  commerce:1350,
  industrial:2200,
};

const CLEANING_MULTIPLIER={
  maintenance:1,
  deep:1.35,
  move:1.5,
};

const SIZE_MULTIPLIER={
  small:1,
  medium:1.25,
  large:1.55,
  xl:1.9,
};

const FREQUENCY_MULTIPLIER={
  once:1,
  weekly:0.9,
  biweekly:0.94,
  monthly:0.97,
};

const SHINEXT_SUPPLIES_MULTIPLIER=1.12;

function roundPrice(value){
  return Math.max(0,Math.round(Number(value||0)/20)*20);
}

export function quoteCleaningService(input={}){
  const serviceType=String(input.serviceType||"home");
  const cleaningLevel=String(input.cleaningLevel||"maintenance");
  const spaceSize=String(input.spaceSize||"small");
  const frequency=String(input.frequency||"once");
  const suppliesSource=String(input.suppliesSource||"provider");

  const base=BASE_PRICE[serviceType]??BASE_PRICE.home;
  const cleaning=CLEANING_MULTIPLIER[cleaningLevel]??1;
  const size=SIZE_MULTIPLIER[spaceSize]??1;
  const frequencyMultiplier=FREQUENCY_MULTIPLIER[frequency]??1;
  const suppliesMultiplier=suppliesSource==="shinext"?SHINEXT_SUPPLIES_MULTIPLIER:1;

  const clientPrice=roundPrice(base*cleaning*size*frequencyMultiplier*suppliesMultiplier);
  const commissionRate=suppliesSource==="shinext"?0.2:0.15;
  const shinextCommission=clientPrice*commissionRate;
  const workerEarning=clientPrice-shinextCommission;

  return {
    clientPrice,
    commissionRate,
    shinextCommission,
    workerEarning,
    currency:"MXN",
    pricingVersion:"2026-10-v1",
  };
}

export const pricingConfig=Object.freeze({
  base:BASE_PRICE,
  cleaningMultiplier:CLEANING_MULTIPLIER,
  sizeMultiplier:SIZE_MULTIPLIER,
  frequencyMultiplier:FREQUENCY_MULTIPLIER,
  shinextSuppliesMultiplier:SHINEXT_SUPPLIES_MULTIPLIER,
});
