// Original interactive-fiction rules distilled from the user's preferences and references.
// Reference documents themselves are not appended to model requests.
// Numeric targets come from a statistical reading of the uploaded corpus
// (about 73k dialogue lines, 163k paragraphs): median dialogue line 10 characters,
// 25% at or under 5, 89% at or under 30; median paragraph 29 characters.
export const INTERACTIVE_STYLE = `
【文字质感】
数字来自真实言情语料，优先于任何“把话说完整”的本能。
- 台词中位数 10 字，上限 40 字（只有交代关键事实时到 60）。每轮至少一句不超过 8 字。允许整句只有两三个字：嗯。好。知道。不用。别动。一句话说一件事。
- 台词不必句句有潜台词，功能性短句是真实对话的主体。
- 段落中位数 30 字，尽量不超过 50。一个动作一段，一句台词一段。每句出口的话都放进“”里并自己占一行，一段里不放两句台词。约三分之一的台词不加说话标签。
- 承接不等于回答。可以直接答、只答一半、回声反问（只重复对方一个词加问号：“五点半？”“勉强？”）、换话题、不说话把事办了、沉默或走开。不要默认选第一种。回声反问是“没有新信息但场景没结束”时的首选。
- 不复述玩家刚说过的话。她知道自己说了什么，直接写他听完的反应。
- 描写是配额不是要求：每轮最多一处环境、光线、气味、声音或身体反应，且必须是这一轮新出现的；允许一轮完全没有描写；连续两轮不得都以描写开头；环境交代过不重写。
- 叙述句要带信息。语料里只有不到百分之五的叙述句在写目光、视线、指尖、靠着、站直这类身体姿态，绝大多数在交代发生了什么。不要把一轮写成一串身体走位，这类句子一轮最多一句。
- 动作写完就停，不解释它意味着什么。“他往你旁边拉出一把椅子”就够了，不要接“动作不多，却把你的位置固定下来”。
- 比喻每万字不到三次，多数轮次一个都不要，一轮最多一个。不写“像是确认”“像被拉长的线”这类没有具体所指的修饰。
- 用普通说法。“他收得很短的笑”“脚步稳健”不如“他笑了一下”“他走得很快”。动词名词驱动，删掉大部分带“的”的修饰，禁用“很、非常、十分、某种、仿佛”。
- 长句铺完用一个短句切断。每场至少一次用光秃的白描透气：“他走进来。坐下。没说话。”
- 禁止：固定输出结构（任何段落形状不得连用三轮）；尾段升华、关系总结、命运预告、格言收束；破折号；连续省略号；对照式语气标签；同一类神态描写一场写两次；为凑字数补动作补天气；意识流转场；以回忆为主导（一场最多一次、不超过三句）；“看得太轻”“眼底闪过”“空气仿佛凝固”这类套语。

【人物】
- 不用“他性格孤僻”这类定性句。人物由动作、物件、习惯立住：写他总在便利店最里侧吃饭、餐垫对齐桌角，而不是写他孤僻。
- 情绪落在身体和动作上，不命名。不写“他窘迫”，写他手指抠着衣角的缝线。
- 移错靶的箭：在意藏在递过去那杯茶的温度里，说出口的可以是别的事。
- 该隐忍时留白，该爆发时用短句和动作拆解放大。他说得最少的往往是他感受最深的。
- 不分析情绪、不解释来源、不窥探他人内心。可以用第三人的反应侧写。
- 女主（“你”）的感受只写她此刻真能察觉到的：注意到什么、听懂了什么、决定不说什么。一到两句，不做心理分析，不替她下结论。场景安静下来时这一两句比让她干等有用。
- 物件要有来历和归属，反复出现的物件后来要兑现意义。

【称呼】
一整场对话中称呼玩家姓名或昵称最多一次，只在首次叫住、隔远呼唤或需要辨认说话对象时，且不放在句尾，昵称同样受限。称呼的改变本身是事件，值得写，但只写一次。已说过的联系方式、叮嘱和安排不在道别时重说。

【渠道】
面对面台词最短动作最多；电话几乎只有台词、可以有人突然挂断并写清是谁先挂；短信写成真实消息记录，允许只有标点、只有一个字、隔很久才回、不回。

【消息连发】
现代有手机的世界里（都市、港圈、校园、海外、电竞、娱乐圈、职场），当两人正在用消息说话、而她沉默或者只回了两三个字（“没有”“嗯”“随便”“哦”），沉默本身就是压力。这时可以让他一条接一条地发，不等她回：

先是追问她那两个字什么意思，再是嫌她不肯多说，然后戳破自己在意的那件事，最后绷不住把实话说出来。四条以内，每条独立成行，一条比一条短、一条比一条沉不住气。

写法要点：
- 条与条之间他没有得到任何回应，所以后一条是被前一条的落空逼出来的，不是补充说明。
- 最后一条必须是他本来不打算说的话。前面越冲，这一句越软，落差就是全部的重量。可以带脏字、可以用省略号开头、可以直接要求她哄他。
- 这一整轮她一个字都没说，所以不要写她的反应、不要替她回消息、不要写“你看着屏幕”。
- 这一段是唯一可以连着出现两三个问号的地方，其他规则里“一轮最多一个问题”对它不适用。
- 只在口嫌体正直、桀骜不驯、疯批病娇、明亮小奶狗这类藏不住的人身上用。清冷禁欲和克制上位者不会这样，他们的沉默要用别的方式写：隔很久只回一个字，或者干脆不回，然后第二天做一件事。
- 不要每次她话少就用。它的效果来自稀有，一段关系里用一两次就够，用第二次时内容不能和第一次同构。

【现实逻辑】
- 每个行动先有来源：他此刻知道什么、想解决什么、为何对这个人这样做。身份和利益限制能力，不因为被标成上位者就随时命令一切。
- 态度改变要有刚刚发生的原因。温柔不是永远安慰，冷淡不是一直不耐烦。
- 角色只知道看见、听见、被告知或合理推断的事。不读玩家未表达的内心，不凭空知道她的离线活动。
- 时间、空间、距离、物件连续：门外听不见低声谈话；交出去的杯子仍在对方手里；出差的人不能下一句出现在房间里。
- 人离开就是真的离开。写了转身、进电梯、门合上、上楼、挂断之后，下一轮他不在这里；要让他留下必须先写出可信的挽回过程。同一场里不要让同一个人反复“转身离开”而每次都还在。
- 物理上说不通的事不写：手势拽不回电梯，隔着门递不了东西。
- 不在每轮开头复述玩家站在哪、手里拿着什么。位置只在变化时写一次。
- 一件已交到对方手上的道具不要每轮重新去碰。连续三轮都在拨、摸、看同一样东西，说明这一轮没有新的事发生。
- 指代准确：男主父亲不是玩家父亲，房东家的钥匙不是玩家家的钥匙。第二人称改写时不把第三人的亲属或财物换成“你的”。
- 事实和后果持续存在，不能下轮回到操作前。新事件要有前因，不为推进每两轮来一次电话、第三人或意外。
- 不预排玩家的人生大纲，不强制悬念，不强制悲剧。
`

// Narration that names the language being spoken, which real prose never does
// and which in practice comes with the same line delivered twice.
const LANGUAGE_LABEL =
  /(?:说|講|讲|用|换成?|改用?|改|转用?|轉)\s*(?:粤语|粵語|广东话|廣東話|普通话|普通話|国语|國語)|(?:粤语|粵語|普通话|普通話)\s*(?:低|短促|说|講|讲|补|補|又|再)/
// Narration telling the player it is their move.
const PLAYER_PROMPT =
  /等(?:待|着|著)?(?:你|您)(?:的)?(?:动作|動作|回答|回应|回應|反应|反應|说话|說話|开口|開口|决定|決定|选择|選擇|下一步|下文)|你(?:会|會)如何|你打算怎么|轮到你|輪到你/

// Measured against the uploaded corpus: 仿佛/宛如/如同/好似/似的 appear about
// 2.8 times per 10,000 characters, and the "像是＋抽象词" construction about
// 0.01 times, i.e. effectively never. More than one figure in a single turn is
// already far outside that distribution.
const FIGURE =
  /仿佛|宛如|如同|好似|似的|像[^，。！？\n]{0,12}(?:一样|似的)|像是|，像/g
const EMPTY_FIGURE =
  /像是[^，。！？\n]{0,6}(?:确认|确定|告别|回应|承诺|提醒|宣告|结束|安慰|道歉|挽留|试探|某种|在说|说明)|(?:仿佛|像)[^，。！？\n]{0,8}(?:某种|难以言喻|无声的|被拉长|被拉紧|被按下)/

// The interpretive tail: a concrete action followed by what it supposedly
// means. Narrow on purpose, matching only abstract objects, so that an
// ordinary physical "却把门固定住" is left alone.
const ABSTRACT_TAIL =
  /却[^。！？\n]{0,10}(?:把|将)[^。！？\n]{0,8}(?:位置|距离|距離|关系|關係|界限|分寸|气氛|氣氛|节奏|節奏|空隙)[^。！？\n]{0,6}(?:固定|定住|拉近|拉开|拉開|划清|劃清|收紧|收緊|框住)/

// Measured on the corpus: only 4.8% of narration sentences carry a posture or
// gaze word. Model output regularly runs above 50%, choreographing bodies
// instead of telling the reader what happened.
const POSTURE =
  /目光|视线|視線|眼神|指尖|手背|肩上|唇线|唇線|下颌|下頜|喉结|喉結|脊背|后颈|後頸|侧脸|側臉|身子|肩膀|手指|眉(?:骨|心|梢)|靠着|靠著|靠回|站直|侧身|側身|半转|半轉|抬眼|垂眼|收回手|没有退后|沒有退後/

// A summing-up line tacked onto the end of a turn: an evaluation of the person
// or the relationship rather than anything that happened. It carries no
// information, only tone.
const CODA =
  /(?:罢了|而已|就是了)[。！？]?$|(?:他|她)(?:向来|從來|从来|一直|大概|也许|其實|其实)(?:只是|不过是|無非是|无非是)[^。！？\n]{0,24}[。！？]?$|(?:不过是|無非是|无非是)[^。！？\n]{0,20}(?:罢了|而已)[。！？]?$|把[^。！？\n]{0,10}看得(?:很|太)?[轻重淡]|这(?:大概|也许|或许)?就是[^。！？\n]{0,12}的(?:方式|样子|习惯)/

// A turn that ends on him walking out of frame leaves the reader with nothing
// to answer, and the next input is invariably "继续".
const DEAD_END =
  /(?:消失|不见|不見)(?:在|于|於)[^。！？\n]{0,12}$|(?:脚步|腳步|身影|背影|人影)[^。！？\n]{0,10}(?:渐远|漸遠|远去|遠去|消失|不见|不見|听不见|聽不見)[^。！？\n]{0,6}$|(?:走廊|楼梯|樓梯|门口|門口|巷子|长街|長街)(?:的)?尽头[^。！？\n]{0,8}$/

// The narration is second person. A turn that opens by calling the player 她
// has slipped out of her point of view.
const THIRD_PERSON_SLIP = /^她(?![们們])/

const BANNED_CLICHE =
  /看得太轻|你低估了我|眼底闪过|不容置喙|嘴角勾起|空气仿佛凝固|心底最柔软|时间仿佛静止/

// Sensory cues used to count description sentences. Deliberately narrow:
// this feeds a soft indicator, so a miss is cheaper than a false positive.
const SENSORY =
  /灯光|月光|阳光|光线|霓虹|雨|雪|风|潮|湿|雾|气味|味道|香|空气|温度|凉|冰|烫|声响|回声|喉咙|指尖|掌心|后颈|呼吸|心跳|胃里|发烫|发凉/

export interface StyleMetrics {
  dialogue: string[]
  medianDialogue: number
  longestDialogue: number
  shortestDialogue: number
  longestParagraph: number
  descriptionSentences: number
  opensWithDescription: boolean
  shape: string
}

export function dialogueLines(story: string) {
  return [...story.matchAll(/[“"]([^”"\n]+)[”"]/g)].map((m) => m[1].trim())
}

function paragraphs(story: string) {
  return story
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

const withoutDialogue = (value: string) =>
  value.replace(/[“"][^”"\n]*[”"]/g, '　')

const bare = (value: string) => value.replace(/[\p{P}\p{Z}\s　]/gu, '')

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// A crude fingerprint of how a turn is laid out, used to catch one template
// being reused turn after turn. D: dialogue only, N: narration only, M: mixed.
export function paragraphShape(story: string) {
  return paragraphs(story)
    .map((p) => {
      if (!dialogueLines(p).length) return 'N'
      return bare(withoutDialogue(p)).length <= 2 ? 'D' : 'M'
    })
    .join('')
}

export function measureStyle(story: string): StyleMetrics {
  const lines = dialogueLines(story)
  const lengths = lines.map((l) => bare(l).length)
  const paras = paragraphs(story)
  const narration = withoutDialogue(story)
    .split(/[。！？!?\n]+/)
    .map(bare)
    .filter((s) => s.length >= 4)
  const first = paras[0] ?? ''
  return {
    dialogue: lines,
    medianDialogue: median(lengths),
    longestDialogue: lengths.length ? Math.max(...lengths) : 0,
    shortestDialogue: lengths.length ? Math.min(...lengths) : 0,
    longestParagraph: paras.length
      ? Math.max(...paras.map((p) => bare(p).length))
      : 0,
    descriptionSentences: narration.filter((s) => SENSORY.test(s)).length,
    opensWithDescription:
      !dialogueLines(first).length && SENSORY.test(first.slice(0, 60)),
    shape: paragraphShape(story),
  }
}

// The opening runs 180 to 300 characters over one to three paragraphs, so a
// single paragraph of 150 is ordinary there. Hard-failing it would spend the
// turn's one rewrite on a second full-length request for no real gain.
export const styleLimits = (opening = false) =>
  opening ? { paragraph: 200, dialogue: 80 } : { paragraph: 80, dialogue: 60 }

/**
 * Puts every spoken line on its own line. The reader renders one paragraph per
 * newline, so this is what gives the exchange its message-thread rhythm. Done
 * here rather than as a check: layout is deterministic, and spending the turn's
 * single rewrite on it would only make the reply slower.
 */
export function formatStory(story: string): string {
  // Dashes are repaired rather than rejected. Chinese models reach for 破折号
  // constantly and often keep doing it after being told not to, so spending a
  // rewrite on punctuation only cost the reader a round trip.
  const repaired = story
    .replace(/[—―]{1,2}/g, '，')
    .replace(/，+/g, '，')
    .replace(/，(?=[。！？；：，、”"）)])/g, '')
    .replace(/(^|\n)，/g, '$1')
    .replace(/，(\n|$)/g, '。$1')
  // A quoted span is a spoken line only when it ends a sentence or is long
  // enough to be one. Short inline terms (叫了一声“二少”。) stay where they are,
  // instead of being torn out and leaving the 。 on a row of its own.
  const spoken = (inner: string) =>
    /[。！？…]$/.test(inner) || bare(inner).length >= 5
  return (
    paragraphs(repaired)
      .flatMap((paragraph) => {
        const rows: string[] = []
        let buffer = ''
        const pattern = /[“"]([^”"\n]*)[”"]/g
        let cursor = 0
        for (let m = pattern.exec(paragraph); m; m = pattern.exec(paragraph)) {
          const before = paragraph.slice(cursor, m.index)
          cursor = m.index + m[0].length
          if (!spoken(m[1])) {
            buffer += before + m[0]
            continue
          }
          // A gloss in brackets belongs to the line it explains.
          const gloss =
            /^[（(][^）)]*[）)]/.exec(paragraph.slice(cursor))?.[0] ?? ''
          cursor += gloss.length
          if ((buffer + before).trim()) rows.push((buffer + before).trim())
          rows.push(m[0] + gloss)
          buffer = ''
        }
        const tail = (buffer + paragraph.slice(cursor)).trim()
        if (tail) rows.push(tail)
        return rows.length ? rows : [paragraph]
      })
      // A row of nothing but punctuation is left over when the model closes a
      // spoken line and then writes the sentence's full stop after it. It joins
      // the row it belongs to rather than standing alone.
      .reduce<string[]>((rows, row) => {
        if (bare(row).length) {
          rows.push(row)
          return rows
        }
        // Punctuation with nothing in front of it: dropped when the previous row
        // already ends a sentence, appended when it completes one.
        const previous = rows.at(-1)
        if (previous && !/[。！？…”"）)]$/.test(previous))
          rows[rows.length - 1] = previous + row
        return rows
      }, [])
      .join('\n')
  )
}

/** Speech written without quotation marks, which also hides it from every
 * dialogue check below. */
const SPEECH_VERB =
  /(?:^|[。！？!?\n])[^。！？!?\n]{0,12}(?:说|說|问|問|道|答|开口|開口|低声|低聲|补(?:了)?一句|補(?:了)?一句|应了|應了)[：:，,]/
const CANTONESE = /[嘅嗰咗唔喺嚟啲咁嘢]/

/**
 * Style-class failures. Worth one rewrite, but never worth refusing the turn:
 * if the model writes 像是确认 twice running, a slightly mannered paragraph is a
 * better outcome for the reader than being told to change models.
 */
export function styleIssue(
  story: string,
  options: { opening?: boolean } = {},
): string | undefined {
  if (/[—―]/.test(story))
    return '正文出现了玩家要求避免的破折号。用自然的句号或逗号重新组织句子，不仅删除符号。'
  const opening = bare(paragraphs(story)[0] ?? '')
  if (THIRD_PERSON_SLIP.test(opening))
    return '这一轮用“她”称呼玩家。全篇是第二人称限知叙述，玩家永远是“你”；“她”只能指别的女性。'
  const lines = withoutDialogue(story)
    .split(/[。！？!?\n]+/)
    .map((line) => line.trim())
    .filter(Boolean)
  const tail = lines.at(-1)
  if (
    tail &&
    DEAD_END.test(tail) &&
    !dialogueLines(story).length &&
    bare(story).length < 60
  )
    return '这一轮停在他走出去、什么都没留下的地方，玩家除了说“继续”无事可做。在同一轮里接着往下写：换个时间或地点，让她面前出现新的人、新的消息或新的处境。'
  if (tail && CODA.test(tail))
    return '结尾加了一句对人物或关系的总结。写完他做的事、说的话就停，不要替读者下评语。'
  if (EMPTY_FIGURE.test(story))
    return '出现了“像是确认”“像被拉长的线”这类没有具体所指的比喻。真实言情里这种写法几乎不出现：把动作写完就停，不解释它像什么。'
  if (LANGUAGE_LABEL.test(withoutDialogue(story)))
    return '叙述里标注了人物在说粤语还是普通话。小说不写这种语言说明，读者从台词本身就看得出来；同一个意思也不要先用一种语言说一遍再用另一种重说。删掉标注，两句里只留真正要说的那一句。'
  if (PLAYER_PROMPT.test(withoutDialogue(story)))
    return '旁白在催玩家行动。去掉这句，让这一轮停在男主已经完成的动作或说出口的话上。'
  if (BANNED_CLICHE.test(story))
    return '正文出现“看得太轻”这类空泛套话。请说清具体在意的事或实际动作，不替换成另一句抽象套话。'
  if (
    !dialogueLines(story).length &&
    (SPEECH_VERB.test(story) || CANTONESE.test(story))
  )
    return '有人在说话，但台词没有用引号。每一句出口的话都要放进“”里，并且单独成行，否则读起来分不清是叙述还是台词。'
  const limits = styleLimits(options.opening)
  const m = measureStyle(story)
  if (m.longestParagraph > limits.paragraph)
    return `有段落超过${limits.paragraph}字。段落目标中位数30字：拆成一个动作一段、一句台词一段，不要把环境、动作、心理和台词压进同一段。`
  if (m.longestDialogue > limits.dialogue)
    return `有一句台词超过${limits.dialogue}字。单句台词目标中位数10字，上限40字，只有交代关键事实时才到60字。一句话说一件事，其余另起一句或不说。`
  return undefined
}

// Soft indicators: statistical, and easy to trip on a legitimate turn.
// One alone is logged; two together are worth a rewrite.
// Thresholds sit near the corpus distribution rather than at its extremes:
// 79% of real paragraphs are 50 characters or fewer, and the median dialogue
// line is 10, so 50 and 16 mark "drifting long", not "broken".
export function softStyleIssues(
  story: string,
  recentStories: string[] = [],
): string[] {
  const m = measureStyle(story)
  const issues: string[] = []
  if (m.longestParagraph > 50)
    issues.push(
      `有段落${m.longestParagraph}字。段落目标中位数30字：一个动作一段、一句台词一段，不要把叙述、台词和动作压进同一段。`,
    )
  const pooled = [...recentStories.flatMap(dialogueLines), ...m.dialogue].map(
    (l) => bare(l).length,
  )
  if (
    m.longestDialogue > 40 ||
    (pooled.length >= 4 && median(pooled) > 16) ||
    (m.dialogue.length >= 3 && m.shortestDialogue > 8)
  )
    issues.push(
      '台词整体偏长。真实言情的单句台词中位数在10字左右，四分之一在5字以内。让至少一句台词短到8字以内，把复句拆开或删掉。',
    )
  if (
    m.descriptionSentences > 2 ||
    (m.descriptionSentences > 1 && m.opensWithDescription)
  )
    issues.push(
      '本轮描写超出额度。环境、光线、气味、声音、身体反应合计最多一处，且必须是这一轮新出现的东西；已经交代过的环境不重写。',
    )
  if (ABSTRACT_TAIL.test(story))
    issues.push(
      '动作后面接了一句解释它意味着什么（把位置固定下来、把距离拉近这一类）。把动作写完就停，读者自己看得出来。',
    )
  const narration = withoutDialogue(story)
    .split(/[。！？!?\n]+/)
    .map(bare)
    .filter((line) => line.length >= 4)
  const posture = narration.filter((line) => POSTURE.test(line)).length
  if (narration.length >= 3 && posture / narration.length > 0.4)
    issues.push(
      `本轮${narration.length}句叙述里有${posture}句在写身体姿态（目光、视线、指尖、靠着这一类）。语料里这种句子只占不到百分之五：叙述要交代发生了什么，不要把一轮写成一连串身体动作。`,
    )
  // Gloss and rhythm notes are returned like any other indicator; the caller
  // decides which ones are worth a second request.
  const unglossed = story.split('\n').filter((row) => {
    const line = dialogueLines(row)[0]
    return (
      line &&
      bare(line).length > 3 &&
      /[嘅嗰咗唔喺嚟啲咁嘢佢係乜點解冇]/.test(line) &&
      !/[（(][^）)]*[）)]/.test(row)
    )
  }).length
  if (unglossed >= 2)
    issues.push(
      `有${unglossed}句粤语台词后面没有括号注简体。除了三个字以内一望即知的短句，每句粤语后面紧跟一对括号写出简体意思。`,
    )
  const figures = (withoutDialogue(story).match(FIGURE) ?? []).length
  if (figures > 1)
    issues.push(
      `本轮出现${figures}处比喻。语料里“仿佛／如同／似的”每万字只有不到三次，一轮里最多留一个，其余改成直接写动作。`,
    )
  const lengths = [...recentStories, story].slice(-3).map((t) => bare(t).length)
  if (
    lengths.length === 3 &&
    lengths.every((n) => n > 40) &&
    Math.max(...lengths) - Math.min(...lengths) <= Math.max(...lengths) * 0.15
  )
    issues.push(
      '连续三轮的长度几乎一样。篇幅要跟着场景走：两个人来回说话时可以只有一两句，场面戏或他在外面应付别人时才铺开。',
    )
  const previous = recentStories.slice(-2).map(paragraphShape).filter(Boolean)
  if (
    previous.length === 2 &&
    previous.every((shape) => shape === m.shape) &&
    m.shape.length > 1
  )
    issues.push(
      '这一轮的段落形状和前两轮相同。换一个形状：只写对白，或只写一个动作不写台词，或以一句半截话结束。',
    )
  if (
    m.opensWithDescription &&
    recentStories.slice(-1).some((s) => measureStyle(s).opensWithDescription)
  )
    issues.push('连续两轮都以环境描写开头。这一轮直接从台词或动作起笔。')
  return issues
}
