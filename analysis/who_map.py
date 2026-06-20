import pandas as pd, geopandas as gpd, numpy as np, matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Patch, Rectangle
from matplotlib.lines import Line2D

from _paths import ATTACK_RATES_CSV, TN_GEOJSON, MAPS

plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9})

df=pd.read_csv(ATTACK_RATES_CSV)
def norm(s): return str(s).lower().replace('the ','').replace(' ','').replace('-','')
alias={'Chengalpattu':'Chengalputtu','Kanchipuram':'Kancheepuram',
       'Tuticorin':'Thoothukkudi','Villupuram':'Viluppuram'}
df['gbkey']=df['District'].map(lambda d: norm(alias.get(d,d)))
gdf=gpd.read_file(TN_GEOJSON); gdf['gbkey']=gdf['shapeName'].map(norm)
m=gdf.merge(df,on='gbkey',how='left')
state=m.dissolve()  # state outline

# ---- WHO-style classed bins & palette (sequential, colour-blind safe) ----
bins=[0,20,40,60,100,200]
labels=['< 20','20 – 39','40 – 59','60 – 99','≥ 100']
palette=['#ffffcc','#fed976','#fd8d3c','#e31a1c','#800026']  # light->dark (YlOrRd)

def classify(v):
    if pd.isna(v): return -1
    for i in range(len(bins)-1):
        if v < bins[i+1]: return i
    return len(bins)-2
def draw(col,year,fname):
    m['cls']=m[col].map(classify)
    fig,ax=plt.subplots(figsize=(8.5,10.5))
    fig.patch.set_facecolor('white')
    # plot each class
    for i,c in enumerate(palette):
        sub=m[m['cls']==i]
        if len(sub): sub.plot(ax=ax,color=c,edgecolor='white',linewidth=0.6)
    nd=m[m['cls']==-1]
    if len(nd): nd.plot(ax=ax,color='#d9d9d9',edgecolor='white',linewidth=0.6)
    state.boundary.plot(ax=ax,color='#4d4d4d',linewidth=1.1)  # state outline
    # district labels (small, no values -> clean)
    for _,row in m.iterrows():
        p=row.geometry.representative_point()
        ax.annotate(row['shapeName'],(p.x,p.y),fontsize=4.6,ha='center',
                    va='center',color='#333333')
    ax.axis('off')
    # title block (top-left)
    ax.set_title('')
    fig.text(0.06,0.955,'Dengue attack rate by district, Tamil Nadu, India',
             fontsize=14,fontweight='bold',ha='left',color='#1a1a1a')
    fig.text(0.06,0.928,f'Reported cases per 100 000 population, {year}',
             fontsize=10.5,ha='left',color='#555555')
    # legend box
    handles=[Patch(facecolor=palette[i],edgecolor='#888888',label=labels[i]) for i in range(len(labels))]
    handles.append(Patch(facecolor='#d9d9d9',edgecolor='#888888',label='No data'))
    leg=ax.legend(handles=handles,title='Attack rate\nper 100 000',
                  loc='lower left',bbox_to_anchor=(0.0,0.02),frameon=True,
                  fontsize=8.5,title_fontsize=9,borderpad=0.9,labelspacing=0.5)
    leg.get_frame().set_edgecolor('#999999'); leg.get_frame().set_linewidth(0.8)
    leg._legend_box.align='left'
    # neatline frame
    fig.patches.append(Rectangle((0.02,0.02),0.96,0.96,transform=fig.transFigure,
                       fill=False,edgecolor='#bbbbbb',linewidth=1.0))
    # source + disclaimer footnote (WHO style)
    fig.text(0.06,0.052,'Data source: Integrated Health Information Platform (IHIP), Tamil Nadu. '
             'Denominators: Government of Tamil Nadu (Census 2011, projected).',
             fontsize=6.6,ha='left',color='#555555')
    fig.text(0.06,0.034,'The boundaries shown and the designations used on this map do not imply '
             'any opinion concerning the legal status of any territory.',
             fontsize=6.0,ha='left',style='italic',color='#777777')
    plt.subplots_adjust(left=0.04,right=0.96,top=0.90,bottom=0.08)
    plt.savefig(MAPS / fname,dpi=300,facecolor='white',bbox_inches='tight')
    plt.close(); print('saved',MAPS / fname)

draw('AR_2024',2024,'who_attackrate_2024.png')
draw('AR_2025',2025,'who_attackrate_2025.png')
