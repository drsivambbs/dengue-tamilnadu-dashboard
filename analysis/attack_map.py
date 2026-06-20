import pandas as pd, geopandas as gpd, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from _paths import ATTACK_RATES_CSV, TN_GEOJSON, MAPS

df=pd.read_csv(ATTACK_RATES_CSV)
def norm(s): return str(s).lower().replace('the ','').replace(' ','').replace('-','')
alias={'Chengalpattu':'Chengalputtu','Kanchipuram':'Kancheepuram',
       'Tuticorin':'Thoothukkudi','Villupuram':'Viluppuram'}
# geoBoundaries has no Mayiladuthurai (in Nagapattinam) -> merge AR back isn't possible per-poly;
# keep Mayiladuthurai value but it shares Nagapattinam polygon -> we drop separate poly, accept 37 polys
df['gbkey']=df['District'].map(lambda d: norm(alias.get(d,d)))

gdf=gpd.read_file(TN_GEOJSON)
gdf['gbkey']=gdf['shapeName'].map(norm)
m=gdf.merge(df, on='gbkey', how='left')

def draw(col,title,fname,year):
    fig,ax=plt.subplots(figsize=(10,11))
    m.plot(column=col,cmap='YlOrRd',linewidth=0.4,edgecolor='grey',legend=True,ax=ax,
           legend_kwds={'label':'Attack rate / 100,000','shrink':0.6},missing_kwds={'color':'lightgrey'})
    for _,row in m.iterrows():
        c=row.geometry.representative_point()
        v=row[col]
        lbl=f"{row['shapeName']}\n{v:.0f}" if pd.notna(v) else row['shapeName']
        ax.annotate(lbl,(c.x,c.y),fontsize=4.5,ha='center')
    ax.set_title(title,fontsize=13); ax.axis('off'); plt.tight_layout()
    plt.savefig(MAPS / fname,dpi=200,bbox_inches='tight'); plt.close()
    print('saved',MAPS / fname)

draw('AR_2024','Tamil Nadu — Dengue Attack Rate per 100,000, 2024\n(Cases: IHIP; Pop: TN Govt Census-2011 projected)','attackrate_2024.png',2024)
draw('AR_2025','Tamil Nadu — Dengue Attack Rate per 100,000, 2025\n(Cases: IHIP; Pop: TN Govt Census-2011 projected)','attackrate_2025.png',2025)
