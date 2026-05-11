// Festival Templates Configuration
// Indian and Global Festival Themes for Campaign Branding

export const FESTIVAL_TEMPLATES = {
  diwali: {
    id: 'diwali',
    name: 'Diwali Special',
    colors: ['#FF9933', '#FFFFFF', '#138808'],
    emoji: 'diya',
    background: 'gradient-saffron',
    description: 'The festival of lights celebration',
    date: 'October/November',
    duration: 5,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 75
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF9933 0%, #FFE4B5 50%, #FF9933 100%)',
        accentColor: '#FF9933',
        textColor: '#1A1A1A'
      },
      qrFrame: {
        borderColor: '#FF9933',
        cornerStyle: 'diya-lamps'
      }
    }
  },

  holi: {
    id: 'holi',
    name: 'Holi Celebration',
    colors: ['#FF6B6B', '#4ECDC4', '#FFE66D'],
    emoji: 'holi',
    background: 'gradient-colors',
    description: 'The festival of colors',
    date: 'March',
    duration: 2,
    suggestedRewards: {
      scan: 12,
      visit: 30,
      purchase: 65
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(90deg, #FF6B6B 0%, #FFE66D 33%, #4ECDC4 66%, #FF6B6B 100%)',
        accentColor: '#FF6B6B',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#FF6B6B',
        cornerStyle: 'color-bombs'
      }
    }
  },

  christmas: {
    id: 'christmas',
    name: 'Christmas Joy',
    colors: ['#C41E3A', '#228B22', '#FFD700'],
    emoji: 'christmas',
    background: 'gradient-winter',
    description: 'The holiday season celebration',
    date: 'December',
    duration: 25,
    suggestedRewards: {
      scan: 20,
      visit: 40,
      purchase: 100
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #C41E3A 0%, #228B22 50%, #FFD700 100%)',
        accentColor: '#C41E3A',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#228B22',
        cornerStyle: 'holly'
      }
    }
  },

  newyear: {
    id: 'newyear',
    name: 'New Year Bash',
    colors: ['#1A1A2E', '#16213E', '#E94560'],
    emoji: 'newyear',
    background: 'gradient-fireworks',
    description: 'Celebrate the new beginnings',
    date: 'December 31',
    duration: 7,
    suggestedRewards: {
      scan: 25,
      visit: 50,
      purchase: 120
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 50%, #E94560 100%)',
        accentColor: '#E94560',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#E94560',
        cornerStyle: 'fireworks'
      }
    }
  },

  valentine: {
    id: 'valentine',
    name: "Valentine's Love",
    colors: ['#FF1493', '#FFB6C1', '#DC143C'],
    emoji: 'valentine',
    background: 'gradient-hearts',
    description: 'Love is in the air',
    date: 'February 14',
    duration: 14,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 80
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF1493 0%, #FFB6C1 50%, #DC143C 100%)',
        accentColor: '#FF1493',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#FF1493',
        cornerStyle: 'hearts'
      }
    }
  },

  rakhi: {
    id: 'rakhi',
    name: 'Rakhi Celebration',
    colors: ['#FF69B4', '#FFD700', '#DC143C'],
    emoji: 'rakhi',
    background: 'gradient-silk',
    description: 'Celebrate the bond of siblings',
    date: 'August',
    duration: 5,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 70
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF69B4 0%, #FFD700 50%, #FF69B4 100%)',
        accentColor: '#FFD700',
        textColor: '#4A1A4A'
      },
      qrFrame: {
        borderColor: '#FF69B4',
        cornerStyle: 'thread'
      }
    }
  },

  eid: {
    id: 'eid',
    name: 'Eid Mubarak',
    colors: ['#006400', '#FFFFFF', '#C9A227'],
    emoji: 'eid',
    background: 'gradient-moon',
    description: 'Eid celebrations',
    date: 'Variable',
    duration: 3,
    suggestedRewards: {
      scan: 18,
      visit: 40,
      purchase: 85
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #006400 0%, #FFFFFF 50%, #C9A227 100%)',
        accentColor: '#006400',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#C9A227',
        cornerStyle: 'crescent'
      }
    }
  },

  independence: {
    id: 'independence',
    name: 'Independence Day',
    colors: ['#FF9933', '#FFFFFF', '#138808'],
    emoji: 'flag',
    background: 'gradient-flag',
    description: 'Celebrate freedom',
    date: 'August 15',
    duration: 3,
    suggestedRewards: {
      scan: 12,
      visit: 30,
      purchase: 60
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF9933 0%, #FFFFFF 33%, #138808 66%, #000080 100%)',
        accentColor: '#FF9933',
        textColor: '#1A1A1A'
      },
      qrFrame: {
        borderColor: '#138808',
        cornerStyle: 'flag'
      }
    }
  },

  pongal: {
    id: 'pongal',
    name: 'Pongal Harvest',
    colors: ['#FF8C00', '#8B4513', '#228B22'],
    emoji: 'pongal',
    background: 'gradient-harvest',
    description: 'Harvest festival celebration',
    date: 'January',
    duration: 4,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 75
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF8C00 0%, #8B4513 50%, #228B22 100%)',
        accentColor: '#FF8C00',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#8B4513',
        cornerStyle: 'kolam'
      }
    }
  },

  ganesh: {
    id: 'ganesh',
    name: 'Ganesh Chaturthi',
    colors: ['#FF6B35', '#FFD700', '#C41E3A'],
    emoji: 'ganesh',
    background: 'gradient-festive',
    description: 'Festival of Lord Ganesha',
    date: 'August/September',
    duration: 10,
    suggestedRewards: {
      scan: 18,
      visit: 40,
      purchase: 90
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF6B35 0%, #FFD700 50%, #C41E3A 100%)',
        accentColor: '#FFD700',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#FF6B35',
        cornerStyle: 'ganesh'
      }
    }
  },

  navratri: {
    id: 'navratri',
    name: 'Navratri Nights',
    colors: ['#FF1493', '#FFD700', '#FF6B35'],
    emoji: 'dandiya',
    background: 'gradient-garba',
    description: 'Nine nights of dance and devotion',
    date: 'September/October',
    duration: 9,
    suggestedRewards: {
      scan: 16,
      visit: 38,
      purchase: 80
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #FF1493 0%, #FFD700 33%, #FF6B35 66%, #FF1493 100%)',
        accentColor: '#FF1493',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#FFD700',
        cornerStyle: 'dandiya'
      }
    }
  },

  // Western festivals
  easter: {
    id: 'easter',
    name: 'Easter Spring',
    colors: ['#90EE90', '#FFB6C1', '#87CEEB'],
    emoji: 'easter',
    background: 'gradient-spring',
    description: 'Spring celebration',
    date: 'March/April',
    duration: 2,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 75
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #90EE90 0%, #FFB6C1 50%, #87CEEB 100%)',
        accentColor: '#90EE90',
        textColor: '#2F4F4F'
      },
      qrFrame: {
        borderColor: '#FFB6C1',
        cornerStyle: 'eggs'
      }
    }
  },

  halloween: {
    id: 'halloween',
    name: 'Halloween Spooky',
    colors: ['#FF6600', '#2F2F2F', '#9932CC'],
    emoji: 'halloween',
    background: 'gradient-spooky',
    description: 'Trick or treat season',
    date: 'October 31',
    duration: 3,
    suggestedRewards: {
      scan: 15,
      visit: 35,
      purchase: 80
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #2F2F2F 0%, #FF6600 50%, #9932CC 100%)',
        accentColor: '#FF6600',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#9932CC',
        cornerStyle: 'pumpkin'
      }
    }
  },

  blackfriday: {
    id: 'blackfriday',
    name: 'Black Friday Sale',
    colors: ['#000000', '#FFFFFF', '#FF0000'],
    emoji: 'sale',
    background: 'gradient-deals',
    description: 'Biggest sale of the year',
    date: 'Fourth Friday of November',
    duration: 4,
    suggestedRewards: {
      scan: 20,
      visit: 45,
      purchase: 100
    },
    templates: {
      banner: {
        bgGradient: 'linear-gradient(135deg, #000000 0%, #1A1A1A 50%, #000000 100%)',
        accentColor: '#FFFFFF',
        textColor: '#FFFFFF'
      },
      qrFrame: {
        borderColor: '#FF0000',
        cornerStyle: 'tags'
      }
    }
  }
} as const

export type FestivalId = keyof typeof FESTIVAL_TEMPLATES

export interface FestivalTemplate {
  id: string
  name: string
  colors: string[]
  emoji: string
  background: string
  description: string
  date: string
  duration: number
  suggestedRewards: {
    scan: number
    visit: number
    purchase: number
  }
  templates: {
    banner: {
      bgGradient: string
      accentColor: string
      textColor: string
    }
    qrFrame: {
      borderColor: string
      cornerStyle: string
    }
  }
}

// Helper functions
export function getFestivalById(id: FestivalId) {
  return FESTIVAL_TEMPLATES[id]
}

export function getUpcomingFestivals() {
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Return festivals based on current month
  const seasonalFestivals: Record<number, FestivalId[]> = {
    1: ['newyear'],
    2: ['valentine'],
    3: ['holi', 'easter'],
    4: ['easter'],
    8: ['independence', 'rakhi', 'ganesh'],
    9: ['navratri', 'ganesh'],
    10: ['diwali', 'navratri', 'halloween'],
    11: ['diwali', 'blackfriday'],
    12: ['christmas', 'newyear']
  }

  const festivalIds = seasonalFestivals[month] || []
  return festivalIds.map(id => FESTIVAL_TEMPLATES[id]).filter(Boolean)
}

export function getFestivalEmoji(emojiKey: string): string {
  const emojiMap: Record<string, string> = {
    diya: '🪔',
    holi: '🎨',
    christmas: '🎄',
    newyear: '🎆',
    valentine: '❤️',
    rakhi: '🧵',
    eid: '🌙',
    flag: '🇮🇳',
    pongal: '🍚',
    ganesh: '🐘',
    dandiya: '💃',
    easter: '🐰',
    halloween: '🎃',
    sale: '🏷️'
  }
  return emojiMap[emojiKey] || '🎉'
}

export function generateFestivalStyles(festivalId: FestivalId) {
  const festival = FESTIVAL_TEMPLATES[festivalId]
  if (!festival) return null

  return {
    primaryColor: festival.colors[0],
    secondaryColor: festival.colors[1],
    accentColor: festival.colors[2],
    gradient: festival.templates.banner.bgGradient,
    qrBorder: festival.templates.qrFrame.borderColor
  }
}
