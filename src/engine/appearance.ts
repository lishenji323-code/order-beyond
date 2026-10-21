import type {
  ArchetypeId,
  BackgroundId,
  CharacterAppearance,
} from '../types/story'

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]

const palette: Record<
  ArchetypeId,
  Partial<Record<keyof CharacterAppearance, string[]>>
> = {
  gentle_tease: {
    hair: ['深棕短发，发尾有一点自然卷', '黑色短发，额前松散'],
    face: ['眉眼舒展，笑起来有很浅的卧蚕', '五官清俊，神情总显得松弛'],
    style: ['质地很好的针织衫和大衣', '简单衬衫，袖口经常随手挽起'],
    signature: ['右手虎口有一颗很淡的痣', '总戴一只旧表'],
  },
  cool_quiet: {
    hair: ['黑色短发，轮廓利落', '偏长的黑发，习惯往后拨'],
    face: ['眼型偏窄，神情寡淡', '鼻梁很直，几乎不做多余表情'],
    style: ['深色外套和干净球鞋', '黑白灰为主，很少戴配饰'],
    signature: ['说话时会无意识转杯沿', '左耳有一个很小的耳洞'],
  },
  restrained_power: {
    hair: ['剪得很整齐的黑发', '深棕短发，永远打理得利落'],
    face: ['眉骨清晰，眼神沉静', '轮廓锋利，神情很少失控'],
    style: ['剪裁克制的西装和长大衣', '衬衫西裤，不追潮流但材质很好'],
    signature: ['一只低调机械表', '左手食指有一道旧伤'],
  },
  free_spirit: {
    hair: ['微长黑发，偶尔扎起来', '深棕卷发，像刚从风里走回来'],
    face: ['眉眼漂亮张扬，笑起来很坏', '眼睛很亮，神情总像在走神'],
    style: ['旧皮衣、T恤和宽松长裤', '随手混搭的设计师单品'],
    signature: ['耳骨一排细小耳钉', '身上有淡淡烟草和木质香'],
  },
  wild_danger: {
    hair: ['剃得很短的黑发', '被太阳晒浅的短发'],
    face: ['肤色偏深，眉骨和下颌都很明显', '眼神直接，鼻梁旁有一道浅疤'],
    style: ['洗旧T恤、工装裤和运动鞋', '皮夹克和旧牛仔裤'],
    signature: ['手背有旧伤', '右眉一道不明显的疤'],
  },
  bright_unreliable: {
    hair: ['柔软的栗色短发', '黑色中长发，发尾乱翘'],
    face: ['少年气很重，笑起来很招人', '嘴角天生微微上扬'],
    style: ['棒球外套、卫衣和球鞋', '颜色大胆的夹克和宽松长裤'],
    signature: ['一条自己改过的项链', '耳朵上有两个不对称耳洞'],
  },
  sweet_dark: {
    hair: ['极黑的头发，额前碎发微卷', '高马尾或束发，发色浓黑'],
    face: ['眼睛很亮，笑起来显得无害', '长相干净漂亮，安静时反而有压迫感'],
    style: ['浅色衬衫、干净外套', '外表整洁，偏少年感'],
    signature: ['一根永远系得很整齐的发带', '手腕上常绕着一条旧绳'],
  },
  scheming_gentleman: {
    hair: ['黑发梳得整齐，鬓角利落', '略长的头发，常用发冠或发带束起'],
    face: ['眉目温雅，眼底却很难看透', '面色偏白，唇色略淡'],
    style: ['考究但不张扬的正装', '古言场景下多为素色长衫与暗纹衣料'],
    signature: ['常用一枚旧打火机或玉佩', '指间常有一枚素戒'],
  },
  principled_cold: {
    hair: ['乌黑束发，一丝不乱', '简短利落的黑发'],
    face: ['眉眼清冷，视线很稳', '轮廓端正，极少笑'],
    style: ['规整、克制、符合身份的穿着', '颜色很少超过两种'],
    signature: ['衣袖或领口永远收拾得很整齐', '佩一枚有家族意义的旧物'],
  },
  sharp_soft: {
    face: ['眉眼锋利，视线落下来时却很专注'],
    signature: ['说完别扭的话会移开目光'],
  },
  loyal_devoted: {
    face: ['眉目端正，眼神专注而坦率'],
    signature: ['掌心有工作留下的薄茧'],
  },
  silent_doer: {
    hair: ['黑色短发，常被帽子压乱', '深棕短发，不太在意造型'],
    face: ['五官干净耐看，表情不多', '肩颈线条利落，眼神很专注'],
    style: ['功能性外套、运动鞋', '简单T恤和耐穿长裤'],
    signature: ['掌心有训练或工作留下的薄茧', '常背一个用了很久的包'],
  },
}

export function generateAppearance(
  archetype: ArchetypeId,
  background: BackgroundId = 'modern_city',
): CharacterAppearance {
  const p = palette[archetype]
  const appearance = {
    height: pick(['181cm左右', '184cm左右', '186cm左右', '188cm左右']),
    build: pick([
      '肩背挺拔，身形偏瘦但有力量感',
      '比例很好，线条利落',
      '肩宽腿长，体型不夸张',
      '身形高挑，长期运动留下自然肌肉线条',
    ]),
    hair: pick(p.hair ?? ['黑色短发']),
    face: pick(p.face ?? ['五官干净耐看']),
    style: pick(p.style ?? ['简单利落的日常穿着']),
    signature: pick(p.signature ?? ['手腕上有一处很淡的旧伤']),
    aura: pick([
      '靠近时有很明确的存在感',
      '不说话时比说话更有压迫感',
      '第一眼不张扬，但很难忽略',
      '看起来和人群隔着一点距离',
    ]),
  }
  if (background === 'historical_court' || background === 'fantasy') {
    appearance.hair = pick(['黑发以素带束起', '鬓发收得整齐，几缕被雨沾湿'])
    appearance.style = pick([
      '素色长衫，袖口微有磨损',
      '深色外袍，衣襟收得整齐',
    ])
    appearance.signature = pick([
      '左手食指有一道旧伤',
      '腰间系着一枚旧玉',
      '右眉尾有一道淡疤',
    ])
  } else if (background === 'republican_era') {
    appearance.hair = '黑色短发，鬓角整齐'
    appearance.style = pick(['素色长衫，袖口微旧', '深色呢大衣与白衬衫'])
    appearance.signature = pick(['一只旧怀表', '指间常握着一支钢笔'])
  } else if (background === 'apocalypse') {
    appearance.style = '袖口缝补过的防水外套'
    appearance.signature = '手背有一道愈合的旧伤'
  } else {
    appearance.hair =
      appearance.hair.includes('发冠') || appearance.hair.includes('束发')
        ? '黑发，额前微长'
        : appearance.hair
    appearance.style = appearance.style.includes('古言')
      ? '素色衬衫，袖口整齐'
      : appearance.style
    appearance.signature = appearance.signature.includes('或玉佩')
      ? '常用一枚旧打火机'
      : appearance.signature
  }
  return appearance
}
