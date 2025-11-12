// Example data for municipal history of Salamanca
// This file contains examples of how to structure historical information

const historyExamples = [
  {
    cod_ine: "37274", // Salamanca capital
    municipality_name: "Salamanca",
    historical_summary: "Salamanca, known as the 'Golden City' due to the sandstone of its buildings, is one of the oldest university cities in Europe. Its history dates back to pre-Roman times, reaching its peak during the 16th and 17th centuries.",
    
    historical_periods: [
      {
        name: "Pre-Roman Period",
        start_date: "-800",
        end_date: "-220",
        description: "Settlement of the Vettones, a Celtic tribe that inhabited the area. Archaeological remains on San Vicente hill.",
        relevant_figures: [],
        important_events: [
          {
            date: "-300",
            description: "Vettone settlement on San Vicente hill",
            type: "archaeological"
          }
        ]
      },
      {
        name: "Roman Period",
        start_date: "-220",
        end_date: "409",
        description: "Roman conquest and foundation of Salmantica. Important communications hub on the Vía de la Plata.",
        important_events: [
          {
            date: "-220",
            description: "Roman conquest, foundation of Salmantica",
            type: "military"
          },
          {
            date: "50",
            description: "Construction of the Roman bridge over the Tormes",
            type: "architectural"
          }
        ]
      },
      {
        name: "Medieval Repopulation",
        start_date: "1087",
        end_date: "1200",
        description: "Definitive repopulation by Raymond of Burgundy. Construction of the first walls and cathedrals.",
        relevant_figures: [
          {
            name: "Raymond of Burgundy",
            description: "Count who repopulated Salamanca by order of Alfonso VI",
            activity_period: "1087-1107"
          }
        ],
        important_events: [
          {
            date: "1087",
            description: "Definitive repopulation by Raymond of Burgundy",
            type: "political"
          },
          {
            date: "1120",
            description: "Beginning of construction of the Old Cathedral",
            type: "architectural"
          }
        ]
      },
      {
        name: "Medieval University",
        start_date: "1218",
        end_date: "1500",
        description: "Foundation of the University of Salamanca, one of the oldest in Europe. Development of the Salamancan intellectual center.",
        relevant_figures: [
          {
            name: "Alfonso IX of León",
            description: "King founder of the University of Salamanca",
            activity_period: "1188-1230"
          }
        ],
        important_events: [
          {
            date: "1218",
            description: "Foundation of the University of Salamanca",
            type: "educational"
          },
          {
            date: "1255",
            description: "Papal recognition of the University",
            type: "educational"
          }
        ]
      },
      {
        name: "Golden Age",
        start_date: "1500",
        end_date: "1700",
        description: "Period of maximum splendor. Great constructive and intellectual activity. Salamanca School of theology and law.",
        relevant_figures: [
          {
            name: "Francisco de Vitoria",
            description: "Theologian, founder of the Salamanca School, precursor of international law",
            activity_period: "1526-1546"
          },
          {
            name: "Fray Luis de León",
            description: "Poet, humanist and theologian",
            activity_period: "1561-1591"
          }
        ],
        important_events: [
          {
            date: "1513",
            description: "Beginning of construction of the New Cathedral",
            type: "architectural"
          },
          {
            date: "1529",
            description: "Construction of the plateresque facade of the University",
            type: "architectural"
          }
        ]
      }
    ],
    
    historical_monuments: [
      {
        name: "Old Cathedral",
        type: "religious",
        construction_date: "1120-1200",
        style: "romanesque-byzantine",
        description: "First Salamancan cathedral, unique example of romanesque-byzantine style in Spain",
        importance: "national"
      },
      {
        name: "New Cathedral",
        type: "religious",
        construction_date: "1513-1733",
        style: "late gothic and baroque",
        description: "Second cathedral, built to expand worship space",
        importance: "national"
      },
      {
        name: "University of Salamanca",
        type: "educational",
        construction_date: "1218",
        style: "plateresque",
        description: "One of the oldest universities in Europe",
        importance: "international"
      },
      {
        name: "Roman Bridge",
        type: "infrastructure",
        construction_date: "1st century",
        style: "roman",
        description: "Bridge over the Tormes river, part of the Vía de la Plata",
        importance: "national"
      }
    ],
    
    legends_traditions: [
      {
        name: "The University Frog",
        type: "tradition",
        description: "Legend says that whoever finds the frog carved on the University facade will have good luck in studies",
        approximate_origin: "16th century",
        current_validity: true
      },
      {
        name: "The Cathedral Astronaut",
        type: "legend",
        description: "Figure of an astronaut carved on the New Cathedral portal during a 1992 restoration",
        approximate_origin: "1992",
        current_validity: true
      }
    ],
    
    illustrious_figures: [
      {
        name: "Miguel de Unamuno",
        profession: "writer, philosopher",
        life_period: "1864-1936",
        salamanca_connection: "University Rector, lived most of his life in the city",
        relevance: "Key figure of the Generation of '98"
      },
      {
        name: "Gonzalo Torrente Ballester",
        profession: "writer",
        life_period: "1910-1999",
        salamanca_connection: "Born in Salamanca, Cervantes Prize winner",
        relevance: "One of the great Spanish novelists of the 20th century"
      }
    ],
    
    urban_evolution: [
      {
        period: "Medieval",
        description: "Walled nucleus around the cathedral and university",
        characteristics: ["medieval walls", "irregular layout", "primitive main square"]
      },
      {
        period: "16th-17th centuries",
        description: "Controlled expansion, construction of great buildings",
        characteristics: ["Plaza Mayor (1729-1755)", "New Cathedral", "Major Colleges"]
      },
      {
        period: "20th century",
        description: "Modern urban expansion preserving the historic center",
        characteristics: ["northern expansion", "university campus", "heritage conservation"]
      }
    ],
    
    historical_tags: ["university", "medieval", "roman", "golden age", "plaza mayor", "cathedral", "roman bridge", "via de la plata"],
    
    bibliography_sources: [
      {
        author: "José Luis Martín Martín",
        title: "Salamanca in the Middle Ages",
        year: 1985,
        type: "book"
      },
      {
        author: "Horacio Capel",
        title: "The morphology of Spanish university cities",
        year: 1974,
        type: "article"
      }
    ],
    
    historical_images: [
      {
        url: "/assets/history/salamanca_medieval.jpg",
        description: "Engraving of Salamanca in the 16th century",
        approximate_date: "1550",
        author: "Anton van den Wyngaerde"
      }
    ],
    
    public: true,
    validated: true,
    last_update_date: new Date("2024-01-15"),
    data_source: "Provincial Historical Archive, University of Salamanca",
    metadata: {
      data_completeness: 85,
      needs_revision: false,
      collaborators: ["Department of Medieval History", "Municipal Archive"]
    }
  },
  
  // Simpler example for a small municipality
  {
    cod_ine: "37010", // La Alberca
    municipality_name: "La Alberca",
    historical_summary: "Village of medieval origin in the heart of Sierra de Francia, famous for its traditional mountain architecture and ancestral traditions. First village in Spain declared Historic-Artistic Monument in 1940.",
    
    historical_periods: [
      {
        name: "Medieval Foundation",
        start_date: "1200",
        end_date: "1500",
        description: "Foundation of the village in medieval times as a mountain population center",
        important_events: [
          {
            date: "1434",
            description: "First documentary mention of the village",
            type: "documentary"
          }
        ]
      },
      {
        name: "Modern Period",
        start_date: "1500",
        end_date: "1800",
        description: "Development of traditional mountain architecture and consolidation of traditions",
        important_events: [
          {
            date: "1735",
            description: "Construction of the current parish church",
            type: "architectural"
          }
        ]
      }
    ],
    
    historical_monuments: [
      {
        name: "Main Square",
        type: "urban",
        construction_date: "16th-17th centuries",
        style: "popular mountain",
        description: "Porticoed square with wooden and stone arcades",
        importance: "regional"
      },
      {
        name: "Church of Our Lady of the Assumption",
        type: "religious",
        construction_date: "1735",
        style: "popular baroque",
        description: "Parish church with churrigueresque altarpiece",
        importance: "local"
      }
    ],
    
    legends_traditions: [
      {
        name: "La Loa",
        type: "tradition",
        description: "Religious theatrical representation celebrated on Assumption Day",
        approximate_origin: "17th century",
        current_validity: true
      },
      {
        name: "Saint Anthony's Pig",
        type: "tradition",
        description: "Tradition of releasing a pig through the streets on Saint Anthony's Day",
        approximate_origin: "medieval",
        current_validity: true
      }
    ],
    
    historical_tags: ["sierra de francia", "popular architecture", "traditions", "historic monument"],
    
    public: true,
    validated: true,
    last_update_date: new Date("2024-01-10"),
    data_source: "Municipal Archive of La Alberca",
    metadata: {
      data_completeness: 70,
      needs_revision: false
    }
  }
];

module.exports = historyExamples;
