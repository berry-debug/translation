export interface LanguageOption {
  code: string;
  zhName: string;
  enName: string;
  selectable: boolean;
  selected: boolean;
}

export const languageOptions: LanguageOption[] = [
  {
    code: "EN",
    zhName: "英语",
    enName: "English",
    selectable: false,
    selected: true
  },
  {
    code: "JA",
    zhName: "日语",
    enName: "Japanese",
    selectable: true,
    selected: true
  },
  {
    code: "FR",
    zhName: "法语",
    enName: "French",
    selectable: true,
    selected: true
  },
  {
    code: "ES",
    zhName: "西班牙语",
    enName: "Spanish",
    selectable: true,
    selected: true
  },
  {
    code: "PT",
    zhName: "葡萄牙语",
    enName: "Portuguese",
    selectable: true,
    selected: true
  },
  {
    code: "DE",
    zhName: "德语",
    enName: "German",
    selectable: true,
    selected: true
  },
  {
    code: "KO",
    zhName: "韩语",
    enName: "Korean",
    selectable: true,
    selected: true
  },
  {
    code: "ZH-CN",
    zhName: "简体中文",
    enName: "Simplified Chinese",
    selectable: true,
    selected: true
  }
];
